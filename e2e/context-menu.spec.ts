import { expect, test } from '@playwright/test'

import {
  createDocument,
  signUp,
  typeInEditor,
  uniqueEmail,
  waitForSaved,
} from './helpers'

test.describe('context menu', () => {
  test('right-clicking a page in the sidebar opens the same menu as the row button', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('context-sidebar'))
    await createDocument(page, 'Ata da reunião')

    const nav = page.getByRole('region', { name: 'Privado' })
    const row = nav.getByRole('link', { name: /Ata da reunião/ })

    await row.click({ button: 'right' })

    await expect(page.getByRole('menuitem', { name: 'Renomear' })).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: 'Duplicar documento' }),
    ).toBeVisible()
    await expect(
      page.getByRole('menuitem', { name: 'Mover para a lixeira' }),
    ).toBeVisible()

    await page.keyboard.press('Escape')

    await nav.getByRole('button', { name: 'Ações de Ata da reunião' }).click()

    await expect(page.getByRole('menuitem', { name: 'Renomear' })).toBeVisible()
  })

  test('renaming from the sidebar changes the title everywhere', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('context-rename'))
    await createDocument(page, 'Nome antigo')

    const nav = page.getByRole('region', { name: 'Privado' })

    await nav.getByRole('link', { name: /Nome antigo/ }).click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Renomear' }).click()

    await page.getByLabel('Novo nome da página').fill('Nome novo')
    await page.getByRole('button', { name: 'Renomear' }).click()

    await expect(nav.getByRole('link', { name: /Nome novo/ })).toBeVisible()
    await expect(page.getByLabel('Título do documento')).toHaveValue('Nome novo')
  })

  test('right-clicking a page in the trash restores it', async ({ page }) => {
    await signUp(page, uniqueEmail('context-trash'))
    await createDocument(page, 'Volta da lixeira')

    await page.getByRole('button', { name: 'Ações do documento' }).click()
    await page.getByRole('menuitem', { name: 'Mover para a lixeira' }).click()
    await expect(page.getByText('Documento movido para a lixeira')).toBeVisible()

    await page.getByRole('button', { name: /^Lixeira/ }).click()

    await page
      .getByRole('listitem')
      .filter({
        has: page.getByRole('button', { name: 'Restaurar Volta da lixeira' }),
      })
      .click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Restaurar' }).click()

    await expect(page.getByText('Documento restaurado')).toBeVisible()
  })

  test('right-clicking a block turns it into another block', async ({ page }) => {
    await signUp(page, uniqueEmail('context-block'))
    await createDocument(page, 'Blocos')
    await typeInEditor(page, 'vira titulo')
    await waitForSaved(page)

    await page
      .locator('.leaf-editor .bn-block-outer')
      .first()
      .click({ button: 'right' })
    await page.getByRole('menuitem', { name: 'Transformar em' }).hover()
    await page.getByRole('menuitem', { name: 'Título 1' }).click()

    await expect(
      page.locator('.leaf-editor [data-content-type="heading"]').first(),
    ).toContainText('vira titulo')
  })
})
