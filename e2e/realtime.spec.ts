import { expect, test, type Page } from '@playwright/test'

import {
  createDocument,
  editorBody,
  signIn,
  signUp,
  typeInEditor,
  uniqueEmail,
  waitForEditorReady,
  waitForSaved,
} from './helpers'

const collaborationServerPattern = /:1235\//

async function waitForCollaboration(page: Page) {
  await waitForEditorReady(page)
  await expect(page.getByText('Colaboração em tempo real')).toBeVisible({
    timeout: 20_000,
  })
}

async function appendLine(page: Page, text: string) {
  const body = editorBody(page)

  await body.click()
  await page.keyboard.press('Control+End')
  await page.keyboard.press('Enter')
  await page.keyboard.type(text)
}

test.describe('realtime collaboration', () => {
  test('two contexts converge on the same document', async ({ browser }) => {
    const owner = await browser.newContext()
    const guest = await browser.newContext()
    const ownerPage = await owner.newPage()
    const guestPage = await guest.newPage()
    const guestEmail = uniqueEmail('collab')

    await signUp(guestPage, guestEmail, 'Guest')
    await signUp(ownerPage, uniqueEmail('owner'), 'Owner')

    const id = await createDocument(ownerPage, 'Collaborative document')

    await waitForCollaboration(ownerPage)

    await ownerPage.getByRole('button', { name: 'Compartilhar' }).click()
    await ownerPage.getByLabel('Email', { exact: true }).fill(guestEmail)
    await ownerPage.getByRole('button', { name: 'Convidar' }).click()
    await expect(ownerPage.getByText(guestEmail)).toBeVisible()
    await ownerPage
      .getByRole('combobox', { name: `Papel de ${guestEmail}` })
      .click()
    await ownerPage.getByRole('option', { name: 'Pode editar' }).click()
    await expect(ownerPage.getByText('Papel atualizado')).toBeVisible()
    await ownerPage.getByRole('button', { name: 'Fechar' }).click()
    await expect(ownerPage.getByRole('dialog')).toHaveCount(0)

    await guestPage.goto(`/doc/${id}`)
    await waitForCollaboration(guestPage)

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
    const firstPage = await first.newPage()
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
