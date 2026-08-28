import { expect, test } from '@playwright/test'

import {
  createDocument,
  signUp,
  typeInEditor,
  uniqueEmail,
  waitForSaved,
} from './helpers'

test.describe('sidebar', () => {
  test('busca filtra por título, atalho foca o campo e o vazio é sinalizado', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('busca'))
    await createDocument(page, 'Relatório de férias')
    await createDocument(page, 'Plano de leitura')

    const search = page.getByLabel('Buscar documento pelo título')

    await search.fill('relat')

    const nav = page.getByRole('navigation', { name: 'Documentos' })

    await expect(nav.getByRole('link', { name: /Relatório de férias/ })).toBeVisible()
    await expect(nav.getByRole('link', { name: /Plano de leitura/ })).toHaveCount(0)

    await search.fill('coisa que não existe')
    await expect(
      nav.getByText('Nenhum documento com esse nome').first(),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Limpar busca' }).click()
    await expect(search).toHaveValue('')
    await expect(nav.getByRole('link', { name: /Plano de leitura/ })).toBeVisible()

    await page.keyboard.press('Control+p')
    await expect(page.getByLabel('Buscar documento pelo título')).toBeFocused()
  })

  test('duplicar copia título e conteúdo sem tocar no original', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('duplicar'))
    await createDocument(page, 'Modelo de ata')
    await typeInEditor(page, 'texto original da ata')
    await waitForSaved(page)

    await page.getByRole('button', { name: 'Ações do documento' }).click()
    await page.getByRole('menuitem', { name: 'Duplicar documento' }).click()

    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Modelo de ata (cópia)',
    )
    await expect(
      page.locator('.leaf-editor [contenteditable="true"]').first(),
    ).toContainText('texto original da ata')

    const nav = page.getByRole('navigation', { name: 'Documentos' })

    await expect(nav.getByRole('link', { name: /Modelo de ata$/ })).toBeVisible()
    await expect(
      nav.getByRole('link', { name: /Modelo de ata \(cópia\)/ }),
    ).toBeVisible()
  })

  test('mover para a lixeira oferece desfazer no toast', async ({ page }) => {
    await signUp(page, uniqueEmail('lixeira'))
    const id = await createDocument(page, 'Some e volta')

    await page.getByRole('button', { name: 'Ações do documento' }).click()
    await page.getByRole('menuitem', { name: 'Mover para a lixeira' }).click()

    await expect(page.getByText('Documento movido para a lixeira')).toBeVisible()

    await page.getByRole('button', { name: 'Desfazer' }).click()

    await expect(page.getByText('Documento restaurado')).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`/doc/${id}$`))
    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Some e volta',
    )
  })

  test('estado da árvore sobrevive ao reload', async ({ page }) => {
    await signUp(page, uniqueEmail('arvore'))
    const parent = await createDocument(page, 'Pai')
    const child = await createDocument(page, 'Filho')

    await page.getByRole('button', { name: 'Ações do documento' }).click()
    await page.getByRole('menuitem', { name: 'Mover para outra página' }).click()
    await page.getByRole('radio', { name: /Pai/ }).click()
    await page.getByRole('button', { name: 'Mover' }).click()

    await expect(page.getByText('Documento movido')).toBeVisible()

    const nav = page.getByRole('navigation', { name: 'Documentos' })

    await page.goto(`/doc/${parent}`)
    await expect(nav.getByRole('button', { name: 'Expandir Pai' })).toBeVisible()
    await expect(nav.getByRole('link', { name: /Filho/ })).toHaveCount(0)

    await nav.getByRole('button', { name: 'Expandir Pai' }).click()
    await expect(nav.getByRole('link', { name: /Filho/ })).toBeVisible()

    await page.reload()

    await expect(nav.getByRole('button', { name: 'Recolher Pai' })).toBeVisible()
    await expect(nav.getByRole('link', { name: /Filho/ })).toBeVisible()

    expect(child).toBeTruthy()
  })
})
