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

test.describe('version history', () => {
  test('records one version per throttle window, shows the preview and restores', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('versions'), 'Versions owner')
    await createDocument(page, 'Document with history')

    await typeInEditor(page, 'first draft of the text')
    await waitForSaved(page)

    await typeInEditor(page, ' with an extra passage')
    await page.waitForTimeout(3_000)
    await page.reload()
    await waitForEditorReady(page)

    await expect(editorBody(page)).toContainText('first draft of the text')
    await expect(editorBody(page)).toContainText('with an extra passage')

    const dialog = await openHistory(page)
    const items = dialog
      .getByRole('list', { name: 'Versões salvas' })
      .getByRole('listitem')

    await expect(items).toHaveCount(1)

    await items.first().getByRole('button').click()

    const preview = dialog.getByRole('region', { name: 'Conteúdo da versão' })

    await expect(preview).toContainText('first draft of the text')
    await expect(preview).not.toContainText('with an extra passage')

    await dialog.getByRole('button', { name: 'Restaurar' }).click()
    await expect(dialog.getByText('Restaurar esta versão?')).toBeVisible()
    await dialog.getByRole('button', { name: 'Restaurar' }).click()

    await waitForEditorReady(page)
    await expect(editorBody(page)).toContainText('first draft of the text')
    await expect(editorBody(page)).not.toContainText('with an extra passage')

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

  test('a viewer does not see the history and the invited editor does', async ({
    browser,
  }) => {
    const owner = await browser.newContext()
    const guest = await browser.newContext()
    const ownerPage = await owner.newPage()
    const guestPage = await guest.newPage()
    const guestEmail = uniqueEmail('guest-versions')

    await signUp(guestPage, guestEmail, 'Guest')
    await signUp(ownerPage, uniqueEmail('owner-versions'), 'Owner')

    const id = await createDocument(ownerPage, 'Document with roles')

    await typeInEditor(ownerPage, 'versioned content')
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
