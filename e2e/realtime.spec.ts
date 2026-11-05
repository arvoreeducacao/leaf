import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect, test, type Browser, type Page } from '@playwright/test'
import mysql from 'mysql2/promise'
import * as Y from 'yjs'

import { loadLocalEnv, sandboxDatabaseUrl } from '../scripts/e2e-database.mjs'
import {
  realtimeFragmentName,
  realtimeRoomName,
  realtimeSecretHeader,
} from '../src/lib/realtime'

import {
  collaborationServerPattern,
  createDocument,
  editorBody,
  signIn,
  signUp,
  trackCollaboration,
  typeInEditor,
  uniqueEmail,
  waitForCollaboration,
  waitForCollaborationDrop,
  waitForEditorReady,
  waitForSaved,
} from './helpers'

async function appendLine(page: Page, text: string) {
  const body = editorBody(page)

  await body.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type(text)
}

async function openShareDialog(page: Page) {
  await page.getByRole('button', { name: 'Compartilhar' }).click()
}

async function closeShareDialog(page: Page) {
  await page.getByRole('button', { name: 'Fechar' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

async function changeRole(page: Page, email: string, role: string) {
  await page.getByRole('combobox', { name: `Papel de ${email}` }).click()
  await page.getByRole('option', { name: role }).click()
  await expect(page.getByText('Papel atualizado')).toBeVisible()
}

async function queryDatabase<T>(sql: string, values: Array<string>) {
  loadLocalEnv(process.cwd())

  const connection = await mysql.createConnection(
    sandboxDatabaseUrl('LEAF_E2E_REALTIME_DATABASE_URL', 'leaf_e2e_realtime'),
  )

  try {
    const [rows] = await connection.query(sql, values)

    return rows as T
  } finally {
    await connection.end()
  }
}

async function markEmailVerified(email: string) {
  await queryDatabase(
    'update `user` set email_verified = true where email = ?',
    [email],
  )
}

async function roomIdentity(documentId: string) {
  const rows = await queryDatabase<Array<{ identity: string }>>(
    'select identity from document_realtime_state where document_id = ?',
    [documentId],
  )

  return rows[0]?.identity ?? null
}

async function closeCodeWhenJoining(
  page: Page,
  documentId: string,
  identity: string,
) {
  const room = encodeURIComponent(realtimeRoomName(documentId))

  return page.evaluate(
    (url) =>
      new Promise<number>((resolve) => {
        const socket = new WebSocket(url)

        socket.addEventListener('close', (event) => resolve(event.code))
        socket.addEventListener('open', () => {
          setTimeout(() => socket.close(1000), 1_000)
        })
      }),
    `ws://127.0.0.1:1235/${room}?identity=${encodeURIComponent(identity)}`,
  )
}

async function twoEditors(browser: Browser, title: string) {
  const owner = await browser.newContext()
  const guest = await browser.newContext()
  const ownerPage = trackCollaboration(await owner.newPage())
  const guestPage = trackCollaboration(await guest.newPage())
  const guestEmail = uniqueEmail('collab')

  await signUp(guestPage, guestEmail, 'Guest')
  await markEmailVerified(guestEmail)
  await signUp(ownerPage, uniqueEmail('owner'), 'Owner')

  const id = await createDocument(ownerPage, title)

  await waitForCollaboration(ownerPage)

  await openShareDialog(ownerPage)
  await ownerPage.getByLabel('Email', { exact: true }).fill(guestEmail)
  await ownerPage.getByRole('button', { name: 'Convidar' }).click()
  await expect(ownerPage.getByText(guestEmail)).toBeVisible()
  await changeRole(ownerPage, guestEmail, 'Pode editar')
  await closeShareDialog(ownerPage)

  await guestPage.goto(`/doc/${id}`)
  await waitForCollaboration(guestPage)

  return { owner, guest, ownerPage, guestPage, guestEmail, id }
}

function restartCollaborationServer() {
  const pid = Number(
    readFileSync(join(process.cwd(), '.e2e-realtime', 'realtime.pid'), 'utf8'),
  )

  process.kill(pid, 'SIGTERM')
}

async function rootNodesInRoom(documentId: string) {
  const room = encodeURIComponent(realtimeRoomName(documentId))
  const response = await fetch(`http://127.0.0.1:1235/rooms/${room}`, {
    headers: { [realtimeSecretHeader]: 'leaf-e2e-realtime' },
  })
  const payload = (await response.json()) as { state: string }
  const doc = new Y.Doc()

  Y.applyUpdate(doc, Buffer.from(payload.state, 'base64'))

  const count = doc.getXmlFragment(realtimeFragmentName).length

  doc.destroy()

  return count
}

async function occurrences(page: Page, text: string) {
  const body = await editorBody(page).innerText()

  return body.split(text).length - 1
}

test.describe('realtime collaboration', () => {
  test('two contexts converge on the same document', async ({ browser }) => {
    const { owner, guest, ownerPage, guestPage } = await twoEditors(
      browser,
      'Collaborative document',
    )

    await expect(ownerPage.getByTestId('presence-indicator')).toHaveAttribute(
      'aria-label',
      '2 pessoas neste documento',
      { timeout: 20_000 },
    )
    await expect(guestPage.getByTestId('presence-indicator')).toHaveAttribute(
      'aria-label',
      '2 pessoas neste documento',
      { timeout: 20_000 },
    )

    await typeInEditor(ownerPage, 'line written by the owner')
    await expect(editorBody(guestPage)).toContainText(
      'line written by the owner',
      { timeout: 20_000 },
    )

    await appendLine(guestPage, 'reply from the guest')
    await expect(editorBody(ownerPage)).toContainText('reply from the guest', {
      timeout: 20_000,
    })

    await owner.close()
    await guest.close()
  })

  test('the server stores the room content and it survives the close', async ({
    browser,
  }) => {
    const first = await browser.newContext()
    const firstPage = trackCollaboration(await first.newPage())
    const email = uniqueEmail('persistence')

    await signUp(firstPage, email, 'Author')
    const id = await createDocument(firstPage, 'Persisted document')

    await waitForCollaboration(firstPage)
    await typeInEditor(firstPage, 'text stored by the server')
    await expect(editorBody(firstPage)).toContainText(
      'text stored by the server',
    )

    await first.close()

    const back = await browser.newContext()
    const backPage = await back.newPage()

    await backPage.goto('/login')
    await backPage.waitForTimeout(5_000)
    await signIn(backPage, email)

    await backPage.goto(`/doc/${id}`)
    await waitForEditorReady(backPage)
    await expect(editorBody(backPage)).toContainText(
      'text stored by the server',
      { timeout: 20_000 },
    )

    await back.close()
  })

  test('a restart of the collaboration server keeps every line once', async ({
    browser,
  }) => {
    const { owner, guest, ownerPage, guestPage, id } = await twoEditors(
      browser,
      'Document across a restart',
    )

    await typeInEditor(ownerPage, 'line before the restart')
    await expect(editorBody(guestPage)).toContainText(
      'line before the restart',
      { timeout: 20_000 },
    )
    await ownerPage.waitForTimeout(1_500)

    restartCollaborationServer()
    await waitForCollaborationDrop(ownerPage)
    await waitForCollaborationDrop(guestPage)

    await appendLine(ownerPage, 'owner during the restart')
    await appendLine(guestPage, 'guest during the restart')

    await expect(editorBody(ownerPage)).toContainText(
      'guest during the restart',
      { timeout: 30_000 },
    )
    await expect(editorBody(guestPage)).toContainText(
      'owner during the restart',
      { timeout: 30_000 },
    )

    for (const page of [ownerPage, guestPage]) {
      expect(await occurrences(page, 'line before the restart')).toBe(1)
      expect(await occurrences(page, 'owner during the restart')).toBe(1)
      expect(await occurrences(page, 'guest during the restart')).toBe(1)
    }

    await ownerPage.waitForTimeout(1_500)
    await ownerPage.goto(`/doc/${id}`)
    await waitForCollaboration(ownerPage)
    await expect(editorBody(ownerPage)).toContainText('guest during the restart')
    expect(await occurrences(ownerPage, 'line before the restart')).toBe(1)

    await owner.close()
    await guest.close()
  })

  test('someone who becomes a viewer stops writing into the open document', async ({
    browser,
  }) => {
    const { owner, guest, ownerPage, guestPage, guestEmail } =
      await twoEditors(browser, 'Document with a role change')

    await appendLine(guestPage, 'written while editor')
    await expect(editorBody(ownerPage)).toContainText('written while editor', {
      timeout: 20_000,
    })

    await openShareDialog(ownerPage)
    await changeRole(ownerPage, guestEmail, 'Pode ver')
    await closeShareDialog(ownerPage)
    await guestPage.waitForTimeout(2_000)

    await appendLine(guestPage, 'written after becoming a viewer')
    await ownerPage.waitForTimeout(5_000)
    await expect(editorBody(ownerPage)).not.toContainText(
      'written after becoming a viewer',
    )

    await owner.close()
    await guest.close()
  })

  test('someone who loses access stops writing into the open document', async ({
    browser,
  }) => {
    const { owner, guest, ownerPage, guestPage, guestEmail } =
      await twoEditors(browser, 'Document with access removed')

    await openShareDialog(ownerPage)
    await ownerPage
      .getByRole('button', { name: `Remover acesso de ${guestEmail}` })
      .click()
    await expect(
      ownerPage.getByRole('button', { name: `Remover acesso de ${guestEmail}` }),
    ).toHaveCount(0)
    await closeShareDialog(ownerPage)
    await guestPage.waitForTimeout(2_000)

    await appendLine(guestPage, 'written after losing access')
    await ownerPage.waitForTimeout(5_000)
    await expect(editorBody(ownerPage)).not.toContainText(
      'written after losing access',
    )

    await owner.close()
    await guest.close()
  })

  test('a room seeded again from a save outside it does not duplicate the local copy', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const first = trackCollaboration(await context.newPage())

    await signUp(first, uniqueEmail('reseed'), 'Reseed')
    const id = await createDocument(first, 'Document saved outside the room')

    await waitForCollaboration(first)
    await typeInEditor(first, 'line from the room')
    await first.waitForTimeout(1_500)

    const before = await roomIdentity(id)

    await first.close()
    await new Promise((resolve) => setTimeout(resolve, 2_500))

    const solo = await context.newPage()

    await solo.routeWebSocket(collaborationServerPattern, () => {})
    await solo.goto(`/doc/${id}`)
    await waitForEditorReady(solo)
    await appendLine(solo, 'line saved without the room')
    await waitForSaved(solo)
    await solo.close()

    const page = trackCollaboration(await context.newPage())

    await page.goto(`/doc/${id}`)
    await waitForCollaboration(page)
    await expect(editorBody(page)).toContainText('line saved without the room', {
      timeout: 20_000,
    })
    expect(await occurrences(page, 'line from the room')).toBe(1)
    expect(await occurrences(page, 'line saved without the room')).toBe(1)
    expect(await rootNodesInRoom(id)).toBe(1)

    const after = await roomIdentity(id)

    expect(before).not.toBeNull()
    expect(after).not.toBe(before)
    expect(await closeCodeWhenJoining(page, id, before as string)).toBe(4410)
    expect(await closeCodeWhenJoining(page, id, after as string)).toBe(1000)

    await context.close()
  })

  test('with the collaboration server silent the editor falls back to autosave', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.routeWebSocket(collaborationServerPattern, () => {})

    await signUp(page, uniqueEmail('offline'), 'Offline')
    const id = await createDocument(page, 'Document without collaboration')

    await waitForEditorReady(page)
    await expect(page.getByText('Colaboração em tempo real')).toHaveCount(0)

    await typeInEditor(page, 'written without the collaboration server')
    await waitForSaved(page)

    await page.goto(`/doc/${id}`)
    await waitForEditorReady(page)
    await expect(editorBody(page)).toContainText(
      'written without the collaboration server',
    )

    await context.close()
  })
})
