import { expect, test } from '@playwright/test'

import {
  createDocument,
  editorBody,
  signUp,
  typeInEditor,
  uniqueEmail,
  waitForEditorReady,
  waitForSaved,
} from './helpers'

async function openHistory(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Ações do documento' }).click()
  await page.getByRole('menuitem', { name: 'Histórico de versões' }).click()

  const dialog = page
    .getByRole('dialog')
    .filter({ hasText: 'Histórico de versões' })

  await expect(dialog).toBeVisible()

  return dialog
}

test.describe('histórico de versões', () => {
  test('grava uma versão por janela de throttle, mostra o preview e restaura', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('versoes'), 'Dona das versões')
    await createDocument(page, 'Documento com histórico')

    await typeInEditor(page, 'primeira redacao do texto')
    await waitForSaved(page)

    await typeInEditor(page, ' com um trecho extra')
    await page.waitForTimeout(3_000)
    await page.reload()
    await waitForEditorReady(page)

    await expect(editorBody(page)).toContainText('primeira redacao do texto')
    await expect(editorBody(page)).toContainText('com um trecho extra')

    const dialog = await openHistory(page)
    const items = dialog
      .getByRole('list', { name: 'Versões salvas' })
      .getByRole('listitem')

    await expect(items).toHaveCount(1)

    await items.first().getByRole('button').click()

    const preview = dialog.getByRole('region', { name: 'Conteúdo da versão' })

    await expect(preview).toContainText('primeira redacao do texto')
    await expect(preview).not.toContainText('com um trecho extra')

    await dialog.getByRole('button', { name: 'Restaurar' }).click()
    await expect(dialog.getByText('Restaurar esta versão?')).toBeVisible()
    await dialog.getByRole('button', { name: 'Restaurar' }).click()

    await waitForEditorReady(page)
    await expect(editorBody(page)).toContainText('primeira redacao do texto')
    await expect(editorBody(page)).not.toContainText('com um trecho extra')

    const reopened = await openHistory(page)

    await expect(
      reopened.getByRole('list', { name: 'Versões salvas' }).getByRole('listitem'),
    ).toHaveCount(2)

    await page.keyboard.press('Escape')
    await expect(reopened).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'Ações do documento' }),
    ).toBeFocused()
  })

  test('leitor não vê o histórico e o editor convidado vê', async ({
    browser,
  }) => {
    const owner = await browser.newContext()
    const guest = await browser.newContext()
    const ownerPage = await owner.newPage()
    const guestPage = await guest.newPage()
    const guestEmail = uniqueEmail('convidado-versoes')

    await signUp(guestPage, guestEmail, 'Convidada')
    await signUp(ownerPage, uniqueEmail('dona-versoes'), 'Dona')

    const id = await createDocument(ownerPage, 'Documento com papéis')

    await typeInEditor(ownerPage, 'conteudo versionado')
    await waitForSaved(ownerPage)

    await ownerPage.getByRole('button', { name: 'Compartilhar' }).click()
    await ownerPage.getByLabel('Email', { exact: true }).fill(guestEmail)
    await ownerPage.getByRole('button', { name: 'Convidar' }).click()
    await expect(ownerPage.getByText(guestEmail)).toBeVisible()

    await guestPage.goto(`/doc/${id}`)
    await expect(guestPage.getByText('Somente leitura')).toBeVisible()
    await guestPage.getByRole('button', { name: 'Ações do documento' }).click()
    await expect(
      guestPage.getByRole('menuitem', { name: 'Histórico de versões' }),
    ).toHaveCount(0)
    await guestPage.keyboard.press('Escape')

    await ownerPage
      .getByRole('combobox', { name: `Papel de ${guestEmail}` })
      .click()
    await ownerPage.getByRole('option', { name: 'Pode editar' }).click()
    await expect(ownerPage.getByText('Papel atualizado')).toBeVisible()

    await guestPage.reload()
    await waitForEditorReady(guestPage)

    const dialog = await openHistory(guestPage)

    await expect(
      dialog.getByRole('list', { name: 'Versões salvas' }).getByRole('listitem'),
    ).toHaveCount(1)

    await owner.close()
    await guest.close()
  })
})
