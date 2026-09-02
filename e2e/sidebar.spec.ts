import { expect, test } from '@playwright/test'

import {
  createDocument,
  signUp,
  typeInEditor,
  uniqueEmail,
  waitForSaved,
} from './helpers'

test.describe('sidebar', () => {
  test('duplicating copies title and content without touching the original', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('duplicate'))
    await createDocument(page, 'Minutes template')
    await typeInEditor(page, 'original text of the minutes')
    await waitForSaved(page)

    await page.getByRole('button', { name: 'Ações do documento' }).click()
    await page.getByRole('menuitem', { name: 'Duplicar documento' }).click()

    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Minutes template (cópia)',
    )
    await expect(
      page.locator('.leaf-editor [contenteditable="true"]').first(),
    ).toContainText('original text of the minutes')

    const privateSection = page.getByRole('region', { name: 'Privado' })

    await expect(
      privateSection.getByRole('link', { name: /Minutes template$/ }),
    ).toBeVisible()
    await expect(
      privateSection.getByRole('link', { name: /Minutes template \(cópia\)/ }),
    ).toBeVisible()
  })

  test('moving to the trash offers undo in the toast', async ({ page }) => {
    await signUp(page, uniqueEmail('trash'))
    const id = await createDocument(page, 'Vanishes and returns')

    await page.getByRole('button', { name: 'Ações do documento' }).click()
    await page.getByRole('menuitem', { name: 'Mover para a lixeira' }).click()

    await expect(page.getByText('Documento movido para a lixeira')).toBeVisible()

    await page.getByRole('button', { name: 'Desfazer' }).click()

    await expect(page.getByText('Documento restaurado')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/doc/${id}$`))
    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Vanishes and returns',
    )
  })

  test('the tree state survives the reload', async ({ page }) => {
    await signUp(page, uniqueEmail('tree'))
    const parent = await createDocument(page, 'Parent')
    const child = await createDocument(page, 'Child')

    await page.getByRole('button', { name: 'Ações do documento' }).click()
    await page.getByRole('menuitem', { name: 'Mover para outra página' }).click()
    await page.getByRole('radio', { name: /Parent/ }).click()
    await page.getByRole('button', { name: 'Mover' }).click()

    await expect(page.getByText('Documento movido')).toBeVisible()

    const privateSection = page.getByRole('region', { name: 'Privado' })

    await page.goto(`/doc/${parent}`)
    await expect(
      privateSection.getByRole('button', { name: 'Expandir Parent' }),
    ).toBeVisible()
    await expect(
      privateSection.getByRole('link', { name: /Child/ }),
    ).toHaveCount(0)

    await privateSection.getByRole('button', { name: 'Expandir Parent' }).click()
    await expect(
      privateSection.getByRole('link', { name: /Child/ }),
    ).toBeVisible()

    await page.reload()

    await expect(
      privateSection.getByRole('button', { name: 'Recolher Parent' }),
    ).toBeVisible()
    await expect(
      privateSection.getByRole('link', { name: /Child/ }),
    ).toBeVisible()

    expect(child).toBeTruthy()
  })

  test('customizing the sidebar hides a section and the choice survives a reload', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('customize'))
    await createDocument(page, 'Field notes')

    await expect(page.getByRole('region', { name: 'Privado' })).toBeVisible()

    await page.getByRole('button', { name: 'Customizar barra lateral' }).click()
    await page.getByRole('button', { name: 'Esconder Privado' }).click()
    await page.getByRole('button', { name: 'Concluído' }).click()

    await expect(page.getByRole('region', { name: 'Privado' })).toHaveCount(0)

    await page.reload()

    await expect(page.getByRole('region', { name: 'Privado' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Customizar barra lateral' }).click()
    await page.getByRole('button', { name: 'Mostrar Privado' }).click()
    await page.getByRole('button', { name: 'Concluído' }).click()

    await expect(page.getByRole('region', { name: 'Privado' })).toBeVisible()
  })
})
