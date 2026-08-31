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

test.describe('colaboração em tempo real', () => {
  test('dois contextos convergem no mesmo documento', async ({ browser }) => {
    const owner = await browser.newContext()
    const guest = await browser.newContext()
    const ownerPage = await owner.newPage()
    const guestPage = await guest.newPage()
    const guestEmail = uniqueEmail('colab')

    await signUp(guestPage, guestEmail, 'Convidada')
    await signUp(ownerPage, uniqueEmail('dono'), 'Dono')

    const id = await createDocument(ownerPage, 'Documento colaborativo')

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

    await typeInEditor(ownerPage, 'linha escrita pelo dono')
    await expect(editorBody(guestPage)).toContainText(
      'linha escrita pelo dono',
      { timeout: 20_000 },
    )

    await appendLine(guestPage, 'resposta da convidada')
    await expect(editorBody(ownerPage)).toContainText('resposta da convidada', {
      timeout: 20_000,
    })

    await owner.close()
    await guest.close()
  })

  test('o servidor grava o conteúdo da sala e ele sobrevive ao fechamento', async ({
    browser,
  }) => {
    const first = await browser.newContext()
    const firstPage = await first.newPage()
    const email = uniqueEmail('persistencia')

    await signUp(firstPage, email, 'Autor')
    const id = await createDocument(firstPage, 'Documento persistido')

    await waitForCollaboration(firstPage)
    await typeInEditor(firstPage, 'texto gravado pelo servidor')
    await expect(editorBody(firstPage)).toContainText(
      'texto gravado pelo servidor',
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
      'texto gravado pelo servidor',
      { timeout: 20_000 },
    )

    await back.close()
  })

  test('com o servidor de colaboração mudo o editor cai no autosave', async ({
    browser,
  }) => {
    const context = await browser.newContext()
    const page = await context.newPage()

    await page.routeWebSocket(collaborationServerPattern, () => {})

    await signUp(page, uniqueEmail('offline'), 'Offline')
    const id = await createDocument(page, 'Documento sem colaboração')

    await waitForEditorReady(page)
    await expect(page.getByText('Colaboração em tempo real')).toHaveCount(0)

    await typeInEditor(page, 'escrito sem o servidor de colaboração')
    await waitForSaved(page)

    await page.goto(`/doc/${id}`)
    await waitForEditorReady(page)
    await expect(editorBody(page)).toContainText(
      'escrito sem o servidor de colaboração',
    )

    await context.close()
  })
})
