import { readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  createDocument,
  editorBody,
  expectNoHorizontalOverflow,
  renameDocument,
  signIn,
  signUp,
  trackCollaboration,
  typeInEditor,
  uniqueEmail,
  waitForCollaboration,
  waitForCollaborationDrop,
  waitForEditorReady,
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

const sandbox = join(process.cwd(), '.e2e-realtime')
const pausedFile = join(sandbox, 'realtime.paused')

function restartCollaborationServer() {
  const pid = Number(readFileSync(join(sandbox, 'realtime.pid'), 'utf8'))

  process.kill(pid, 'SIGTERM')
}

function stopCollaborationServer() {
  writeFileSync(pausedFile, '')
  restartCollaborationServer()
}

function startCollaborationServer() {
  rmSync(pausedFile, { force: true })
}

async function setTrashed(documentId: string, trashed: boolean) {
  await queryDatabase(
    `update documents set deleted_at = ${trashed ? 'now(3)' : 'null'} where id = ?`,
    [documentId],
  )
}

async function savedContent(documentId: string) {
  const rows = await queryDatabase<Array<{ content: string | null }>>(
    'select content from documents where id = ?',
    [documentId],
  )

  return rows[0]?.content ?? ''
}

async function savedTitle(documentId: string) {
  const rows = await queryDatabase<Array<{ title: string }>>(
    'select title from documents where id = ?',
    [documentId],
  )

  return rows[0]?.title ?? ''
}

async function createVersion(documentId: string) {
  await queryDatabase(
    'insert into document_versions (id, document_id, title, content, author_id, created_at) select ?, id, title, content, owner_id, now(3) - interval 1 hour from documents where id = ?',
    [`version-${documentId}`, documentId],
  )
}

async function nestUnder(childId: string, parentId: string) {
  await queryDatabase('update documents set parent_id = ? where id = ?', [
    parentId,
    childId,
  ])
}

async function saveOutsideTheRoom(documentId: string, text: string) {
  const blocks = JSON.parse(await savedContent(documentId)) as Array<unknown>

  await queryDatabase(
    'update documents set content = ?, updated_at = now(3) where id = ?',
    [
      JSON.stringify([
        ...blocks,
        {
          id: 'saved-outside-the-room',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text, styles: {} }],
          children: [],
        },
      ]),
      documentId,
    ],
  )
}

function notice(page: Page) {
  return page.getByTestId('document-notice')
}

function anyEditor(page: Page) {
  return page.locator('.leaf-editor [contenteditable]').first()
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

  test('stopping the collaboration server saves the text and closes every tab with a restart code', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const page = trackCollaboration(await context.newPage())

    await signUp(page, uniqueEmail('restart-code'), 'Restart')
    const id = await createDocument(page, 'Document closed for a restart')

    await waitForCollaboration(page)
    await appendLine(page, 'written before the stop')

    const room = encodeURIComponent(realtimeRoomName(id))

    await page.evaluate(
      (url) =>
        new Promise<void>((resolve) => {
          const socket = new WebSocket(url)

          Object.assign(window, {
            restartCloseCode: new Promise<number>((settle) => {
              socket.addEventListener('close', (event) => settle(event.code))
            }),
          })
          socket.addEventListener('open', () => resolve())
        }),
      `ws://127.0.0.1:1235/${room}`,
    )

    stopCollaborationServer()

    try {
      const code = await page.evaluate(
        () =>
          (window as unknown as { restartCloseCode: Promise<number> })
            .restartCloseCode,
      )

      expect(code).toBe(1012)
      await expect
        .poll(() => savedContent(id), { timeout: 10_000 })
        .toContain('written before the stop')
      await expect(notice(page)).toContainText(
        'Reconectando. Suas mudanças estão salvas aqui',
      )
    } finally {
      startCollaborationServer()
    }

    await waitForCollaboration(page, 30_000)
    await expect(notice(page)).toHaveCount(0)

    await context.close()
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

    await expect(notice(guestPage)).toContainText(
      'Seu acesso a este documento mudou para leitura',
    )
    await expect(anyEditor(guestPage)).toHaveAttribute('contenteditable', 'false')

    await appendLine(ownerPage, 'written after the role change')
    await expect(anyEditor(guestPage)).toContainText(
      'written after the role change',
      { timeout: 20_000 },
    )

    await owner.close()
    await guest.close()
  })

  test('someone who loses access sees the no-access page instead of the document', async ({
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

    await expect(
      guestPage.getByText('Você não tem acesso a este documento'),
    ).toBeVisible({ timeout: 20_000 })
    await expect(anyEditor(guestPage)).toHaveCount(0)

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
    await expect
      .poll(() => savedContent(id), { timeout: 20_000 })
      .toContain('line from the room')

    const before = await roomIdentity(id)

    await first.close()
    await new Promise((resolve) => setTimeout(resolve, 2_500))
    await saveOutsideTheRoom(id, 'line saved without the room')

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

  test('a tab that opens while the collaboration server is down shows the saved text read only, then joins', async ({
    browser,
  }) => {
    const email = uniqueEmail('deploy')
    const first = await browser.newContext()
    const page = trackCollaboration(await first.newPage())

    await signUp(page, email, 'Deploy')
    const id = await createDocument(page, 'Opened during a deploy')

    await waitForCollaboration(page)
    await appendLine(page, 'written before the deploy')
    await expect
      .poll(() => savedContent(id), { timeout: 20_000 })
      .toContain('written before the deploy')
    await first.close()

    const second = await browser.newContext()
    const tab = trackCollaboration(await second.newPage())

    await signIn(tab, email)
    stopCollaborationServer()

    try {
      await tab.goto(`/doc/${id}`)
      await expect(notice(tab)).toContainText(
        'Reconectando. Suas mudanças estão salvas aqui',
      )
      await expect(anyEditor(tab)).toContainText('written before the deploy')
      await expect(anyEditor(tab)).toHaveAttribute('contenteditable', 'false')
    } finally {
      startCollaborationServer()
    }

    await waitForCollaboration(tab, 30_000)
    await expect(notice(tab)).toHaveCount(0)

    await appendLine(tab, 'written after the deploy')
    await expect
      .poll(() => savedContent(id), { timeout: 20_000 })
      .toContain('written after the deploy')
    expect(await occurrences(tab, 'written before the deploy')).toBe(1)

    await second.close()
  })

  test('a tab with the document on the device keeps editing while the server is down, and nothing skips the room', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const page = trackCollaboration(await context.newPage())

    await signUp(page, uniqueEmail('away'), 'Away')
    const id = await createDocument(page, 'Edited while the server is down')

    await waitForCollaboration(page)
    await appendLine(page, 'written while connected')
    await expect
      .poll(() => savedContent(id), { timeout: 20_000 })
      .toContain('written while connected')
    await page.goto('about:blank')

    stopCollaborationServer()

    try {
      await page.goto(`/doc/${id}`)
      await expect(notice(page)).toContainText(
        'Reconectando. Suas mudanças estão salvas aqui',
      )
      await appendLine(page, 'written while the server was down')
      await page.waitForTimeout(3_000)
      expect(await savedContent(id)).not.toContain(
        'written while the server was down',
      )
    } finally {
      startCollaborationServer()
    }

    await waitForCollaboration(page, 30_000)
    await expect
      .poll(() => savedContent(id), { timeout: 20_000 })
      .toContain('written while the server was down')
    expect(await occurrences(page, 'written while connected')).toBe(1)

    await context.close()
  })

  test('a document moved to the trash stops the editors, and restoring it brings them back', async ({
    browser,
  }) => {
    test.setTimeout(150_000)

    const { owner, guest, ownerPage, guestPage, id } = await twoEditors(
      browser,
      'Document moved to the trash',
    )
    const ownerTab = trackCollaboration(await owner.newPage())

    await ownerTab.goto(`/doc/${id}`)
    await waitForCollaboration(ownerTab)

    await ownerPage.getByRole('button', { name: 'Ações do documento' }).click()
    await ownerPage.getByRole('menuitem', { name: 'Mover para a lixeira' }).click()

    await expect(notice(guestPage)).toContainText(
      'Este documento foi para a lixeira. Só quem criou pode restaurar.',
    )
    await expect(anyEditor(guestPage)).toHaveAttribute('contenteditable', 'false')
    await expect(notice(ownerTab)).toContainText('Este documento está na lixeira.')

    await ownerTab.getByRole('button', { name: 'Restaurar' }).click()
    await expect(notice(ownerTab)).toHaveCount(0, { timeout: 20_000 })
    await expect(notice(guestPage)).toHaveCount(0, { timeout: 45_000 })

    await appendLine(guestPage, 'written after the restore')
    await expect(editorBody(ownerTab)).toContainText('written after the restore', {
      timeout: 20_000,
    })

    await owner.close()
    await guest.close()
  })

  test('text written as the document goes to the trash is kept, and restoring does not seed the room again', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const page = trackCollaboration(await context.newPage())

    await signUp(page, uniqueEmail('trash-race'), 'Trash race')
    const id = await createDocument(page, 'Written as it goes to the trash')

    await waitForCollaboration(page)
    await appendLine(page, 'written before the trash')
    await expect
      .poll(() => savedContent(id), { timeout: 20_000 })
      .toContain('written before the trash')

    const before = await roomIdentity(id)

    await setTrashed(id, true)
    await appendLine(page, 'written as it went to the trash')
    await expect
      .poll(() => savedContent(id), { timeout: 20_000 })
      .toContain('written as it went to the trash')

    await page.close()
    await new Promise((resolve) => setTimeout(resolve, 2_500))
    await setTrashed(id, false)

    const reopened = trackCollaboration(await context.newPage())

    await reopened.goto(`/doc/${id}`)
    await waitForCollaboration(reopened)

    expect(await occurrences(reopened, 'written as it went to the trash')).toBe(
      1,
    )
    expect(await roomIdentity(id)).toBe(before)

    await context.close()
  })

  test('restoring a version reaches every open tab and stays saved', async ({
    browser,
  }) => {
    const { owner, guest, ownerPage, guestPage, id } = await twoEditors(
      browser,
      'Document with a version to restore',
    )

    await appendLine(ownerPage, 'line in the old version')
    await expect
      .poll(() => savedContent(id), { timeout: 20_000 })
      .toContain('line in the old version')
    await createVersion(id)

    await appendLine(ownerPage, 'line written after the version')
    await expect
      .poll(() => savedContent(id), { timeout: 20_000 })
      .toContain('line written after the version')

    await ownerPage.getByRole('button', { name: 'Ações do documento' }).click()
    await ownerPage.getByRole('menuitem', { name: 'Histórico de versões' }).click()

    const dialog = ownerPage.getByRole('dialog')
    const items = dialog
      .getByRole('list', { name: 'Versões salvas' })
      .getByRole('listitem')

    await items.last().getByRole('button').first().click()
    await expect(
      dialog.getByRole('region', { name: 'Conteúdo da versão' }),
    ).not.toContainText('line written after the version')
    await dialog.getByRole('button', { name: 'Restaurar' }).click()
    await expect(dialog.getByText('Restaurar esta versão?')).toBeVisible()
    await Promise.all([
      ownerPage.waitForEvent('load', { timeout: 20_000 }),
      dialog.getByRole('button', { name: 'Restaurar' }).click(),
    ])

    await expect(editorBody(guestPage)).not.toContainText(
      'line written after the version',
      { timeout: 20_000 },
    )
    await expect(editorBody(guestPage)).toContainText('line in the old version')
    await expect
      .poll(() => savedContent(id), { timeout: 20_000 })
      .not.toContain('line written after the version')

    await waitForEditorReady(ownerPage)
    await expect(editorBody(ownerPage)).not.toContainText(
      'line written after the version',
    )

    await owner.close()
    await guest.close()
  })

  test('on a phone the reconnecting notice shows and reaches screen readers', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    })
    const page = trackCollaboration(await context.newPage())

    await signUp(page, uniqueEmail('phone'), 'Phone')
    await createDocument(page, 'Read on a phone')
    await waitForCollaboration(page)

    stopCollaborationServer()

    try {
      await expect(
        page.getByRole('status').filter({ hasText: 'Reconectando' }),
      ).toBeVisible()
      await expectNoHorizontalOverflow(page)
    } finally {
      startCollaborationServer()
    }

    await waitForCollaboration(page, 30_000)
    await expect(notice(page)).toHaveCount(0)

    await context.close()
  })

  test('a title renamed in one tab reaches the other without a reload, and spares a title being typed', async ({
    browser,
  }) => {
    const { owner, guest, ownerPage, guestPage, id } = await twoEditors(
      browser,
      'Title before the rename',
    )
    const guestTitle = guestPage.getByLabel('Título do documento')

    await renameDocument(ownerPage, 'Title after the rename')
    await expect(guestTitle).toHaveValue('Title after the rename', {
      timeout: 20_000,
    })

    await guestTitle.click()
    await renameDocument(ownerPage, 'Title while the guest only looks')
    await expect(guestTitle).toHaveValue('Title while the guest only looks', {
      timeout: 20_000,
    })
    await guestTitle.blur()
    await guestPage.waitForTimeout(1_500)
    expect(await savedTitle(id)).toBe('Title while the guest only looks')

    await guestTitle.click()
    await guestTitle.fill('Title the guest is typing')
    await renameDocument(ownerPage, 'Title renamed again')
    await expect(
      guestPage.getByRole('link', { name: 'Title renamed again' }).first(),
    ).toBeVisible({ timeout: 20_000 })
    await expect(guestTitle).toHaveValue('Title the guest is typing')

    await owner.close()
    await guest.close()
  })

  test('a comment reaches the other tab without a reload', async ({ browser }) => {
    const { owner, guest, ownerPage, guestPage } = await twoEditors(
      browser,
      'Document with a live comment',
    )

    await ownerPage.getByTestId('comments-button').click()
    await ownerPage.getByLabel('Novo comentário').fill('Comment written in the other tab')
    await ownerPage.getByTestId('submit-comment').click()
    await expect(
      ownerPage.getByText('Comentário adicionado').first(),
    ).toBeVisible()

    await expect(guestPage.getByTestId('document-comments')).toContainText(
      'Comment written in the other tab',
      { timeout: 20_000 },
    )

    await owner.close()
    await guest.close()
  })

  test('a row added in one tab shows in the table of the other without a reload', async ({
    browser,
  }) => {
    const { owner, guest, ownerPage, guestPage, id } = await twoEditors(
      browser,
      'Page that holds a table',
    )

    await ownerPage.getByRole('button', { name: 'Criar novo' }).click()
    await ownerPage.getByRole('menuitem', { name: 'Base de dados' }).click()
    await ownerPage.waitForURL((url) => !url.pathname.endsWith(id))

    const databaseId = ownerPage.url().split('/doc/')[1]

    await nestUnder(databaseId, id)
    await guestPage.goto(`/doc/${databaseId}`)

    const ownerRows = ownerPage.locator('table tbody tr')
    const guestRows = guestPage.locator('table tbody tr')

    await expect(guestPage.locator('table')).toBeVisible({ timeout: 20_000 })

    const before = await ownerRows.count()

    await expect(guestRows).toHaveCount(before)
    await ownerPage.getByRole('button', { name: 'Nova página', exact: true }).click()
    await expect(ownerRows).toHaveCount(before + 1)
    await expect(guestRows).toHaveCount(before + 1, { timeout: 20_000 })

    await owner.close()
    await guest.close()
  })

  test('going back to a table shows the rows added while it was open and while away', async ({
    browser,
  }) => {
    const { owner, guest, ownerPage, guestPage, id } = await twoEditors(
      browser,
      'Page the guest steps out to',
    )

    await ownerPage.getByRole('button', { name: 'Criar novo' }).click()
    await ownerPage.getByRole('menuitem', { name: 'Base de dados' }).click()
    await ownerPage.waitForURL((url) => !url.pathname.endsWith(id))

    const databaseId = ownerPage.url().split('/doc/')[1]

    await nestUnder(databaseId, id)
    await guestPage.goto(`/doc/${databaseId}`)

    const ownerRows = ownerPage.locator('table tbody tr')
    const guestRows = guestPage.locator('table tbody tr')

    await expect(guestPage.locator('table')).toBeVisible({ timeout: 20_000 })

    const before = await ownerRows.count()

    await ownerPage.getByRole('button', { name: 'Nova página', exact: true }).click()
    await expect(guestRows).toHaveCount(before + 1, { timeout: 20_000 })

    await guestPage
      .getByRole('link', { name: 'Page the guest steps out to' })
      .first()
      .click()
    await guestPage.waitForURL((url) => url.pathname.endsWith(id))
    await ownerPage.getByRole('button', { name: 'Nova página', exact: true }).click()
    await expect(ownerRows).toHaveCount(before + 2)

    await guestPage.goBack()
    await expect(guestRows).toHaveCount(before + 2, { timeout: 10_000 })

    await owner.close()
    await guest.close()
  })

  test('going back to a document shows the title and comments changed while it was open and while away', async ({
    browser,
  }) => {
    const { owner, guest, ownerPage, guestPage } = await twoEditors(
      browser,
      'Title the guest saw first',
    )
    const guestComments = guestPage.getByTestId('document-comments')

    await ownerPage.getByTestId('comments-button').click()
    await ownerPage.getByLabel('Novo comentário').fill('Comment seen live')
    await ownerPage.getByTestId('submit-comment').click()
    await expect(guestComments).toContainText('Comment seen live', {
      timeout: 20_000,
    })
    await ownerPage.keyboard.press('Escape')

    await guestPage.getByRole('link', { name: 'Página inicial' }).click()
    await guestPage.waitForURL((url) => url.pathname === '/')

    await renameDocument(ownerPage, 'Title renamed while away')
    await ownerPage
      .getByTestId('document-comment-input')
      .fill('Comment written while away')
    await ownerPage.getByTestId('submit-document-comment').click()
    await expect(ownerPage.getByTestId('document-comments')).toContainText(
      'Comment written while away',
    )

    await guestPage.goBack()
    await expect(guestPage.getByLabel('Título do documento')).toHaveValue(
      'Title renamed while away',
      { timeout: 10_000 },
    )
    await expect(guestComments).toContainText('Comment seen live')
    await expect(guestComments).toContainText('Comment written while away')

    await owner.close()
    await guest.close()
  })

  test('a long breadcrumb fits the header on one line at 1024 px', async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 1024, height: 768 },
    })
    const page = await context.newPage()

    await signUp(page, uniqueEmail('crumbs'), 'Crumbs')

    const grandparent = await createDocument(
      page,
      'Processos de entrega contínua do time de plataforma',
    )
    const parent = await createDocument(
      page,
      'Releases do segundo semestre com janela de manutenção',
    )
    const current = await createDocument(page, 'Guia de deploy')

    await nestUnder(parent, grandparent)
    await nestUnder(current, parent)
    await page.goto(`/doc/${current}`)
    await waitForEditorReady(page)

    const header = page.locator('header').first()
    const crumb = page.getByTestId('document-current-crumb')
    const share = page.getByRole('button', { name: 'Compartilhar' })

    await expect(crumb).toContainText('Guia de deploy')

    const headerBox = await header.boundingBox()
    const crumbBox = await crumb.boundingBox()
    const shareBox = await share.boundingBox()

    expect(headerBox?.height ?? 0).toBeLessThan(60)
    expect((crumbBox?.x ?? 0) + (crumbBox?.width ?? 0)).toBeLessThanOrEqual(
      shareBox?.x ?? 0,
    )
    await expectNoHorizontalOverflow(page)

    await context.close()
  })
})
