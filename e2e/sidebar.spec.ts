import { expect, test } from '@playwright/test'

import {
  createDocument,
  signUp,
  typeInEditor,
  uniqueEmail,
  waitForSaved,
} from './helpers'

test.describe('sidebar', () => {
  test('the search filters by title, the shortcut focuses the field and the empty state shows', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('search'))
    await createDocument(page, 'Vacation report')
    await createDocument(page, 'Reading plan')

    const search = page.getByLabel('Buscar documento pelo título')

    await search.fill('vacat')

    const nav = page.getByRole('navigation', { name: 'Documentos' })

    await expect(nav.getByRole('link', { name: /Vacation report/ })).toBeVisible()
    await expect(nav.getByRole('link', { name: /Reading plan/ })).toHaveCount(0)

    await search.fill('something that does not exist')
    await expect(
      nav.getByText('Nenhum documento com esse nome').first(),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Limpar busca' }).click()
    await expect(search).toHaveValue('')
    await expect(nav.getByRole('link', { name: /Reading plan/ })).toBeVisible()

    await page.keyboard.press('Control+p')
    await expect(page.getByLabel('Buscar documento pelo título')).toBeFocused()
  })

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

    const nav = page.getByRole('navigation', { name: 'Documentos' })

    await expect(nav.getByRole('link', { name: /Minutes template$/ })).toBeVisible()
    await expect(
      nav.getByRole('link', { name: /Minutes template \(cópia\)/ }),
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

    const nav = page.getByRole('navigation', { name: 'Documentos' })

    await page.goto(`/doc/${parent}`)
    await expect(nav.getByRole('button', { name: 'Expandir Parent' })).toBeVisible()
    await expect(nav.getByRole('link', { name: /Child/ })).toHaveCount(0)

    await nav.getByRole('button', { name: 'Expandir Parent' }).click()
    await expect(nav.getByRole('link', { name: /Child/ })).toBeVisible()

    await page.reload()

    await expect(nav.getByRole('button', { name: 'Recolher Parent' })).toBeVisible()
    await expect(nav.getByRole('link', { name: /Child/ })).toBeVisible()

    expect(child).toBeTruthy()
  })
})
