import { expect, test } from '@playwright/test'

import {
  createDocument,
  signUp,
  typeInEditor,
  uniqueEmail,
  waitForSaved,
} from './helpers'

const palette = '[data-testid="command-palette"]'

function paletteList(page: import('@playwright/test').Page) {
  return page.locator(palette).getByRole('listbox')
}

test.describe('busca e command palette', () => {
  test('atalho abre a palette, o texto do documento é encontrado e Enter navega', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('palette'))

    const ata = await createDocument(page, 'Ata da reunião')

    await typeInEditor(page, 'combinamos o cronograma do trimestre')
    await waitForSaved(page)

    const plano = await createDocument(page, 'Plano de leitura')

    await typeInEditor(page, 'o relatório da educação básica pede avaliação')
    await waitForSaved(page)

    await page.keyboard.press('Control+k')

    const overlay = page.locator(palette)

    await expect(overlay).toBeVisible()
    await expect(overlay.getByText('Recentes')).toBeVisible()
    await expect(overlay.getByRole('option', { name: /Plano de leitura/ })).toBeVisible()
    await expect(overlay.getByRole('option', { name: /Ata da reunião/ })).toBeVisible()

    await page.locator('[data-testid="command-palette-input"]').fill('educacao')

    await expect(overlay.getByText('Documentos')).toBeVisible()
    await expect(
      overlay.getByRole('option', { name: /Ata da reunião/ }),
    ).toHaveCount(0)

    const hit = overlay.getByRole('option', { name: /Plano de leitura/ })

    await expect(hit).toBeVisible()
    await expect(hit).toContainText('educação')

    await page.goto(`/doc/${ata}`)
    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Ata da reunião',
    )

    await page.keyboard.press('Control+k')
    await page.locator('[data-testid="command-palette-input"]').fill('relatorio')
    await expect(
      page.locator(palette).getByRole('option', { name: /Plano de leitura/ }),
    ).toBeVisible()
    await page.keyboard.press('Enter')

    await page.waitForURL(`**/doc/${plano}`)
    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Plano de leitura',
    )
  })

  test('setas movem a seleção, Esc fecha e o atalho alterna', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('teclado'))
    await createDocument(page, 'Documento um')
    await createDocument(page, 'Documento dois')

    await page.getByRole('button', { name: /Buscar em tudo/ }).first().click()

    const overlay = page.locator(palette)

    await expect(overlay).toBeVisible()
    await expect(page.locator('[data-testid="command-palette-input"]')).toBeFocused()

    const options = overlay.getByRole('option')

    await expect(options.first()).toHaveAttribute('aria-selected', 'true')

    await page.keyboard.press('ArrowDown')
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(options.first()).toHaveAttribute('aria-selected', 'false')

    await page.keyboard.press('ArrowUp')
    await expect(options.first()).toHaveAttribute('aria-selected', 'true')

    await page.keyboard.press('Escape')
    await expect(overlay).toBeHidden()

    await page.keyboard.press('Control+k')
    await expect(overlay).toBeVisible()
    await page.keyboard.press('Control+k')
    await expect(overlay).toBeHidden()

    await page.keyboard.press('Alt+k')
    await expect(overlay).toBeVisible()
  })

  test('com seleção no editor o Ctrl+K é o link e o Alt+K ainda abre a palette', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('precedencia'))
    await createDocument(page, 'Precedência')

    await typeInEditor(page, 'palavra alvo')

    for (let index = 0; index < 'palavra alvo'.length; index += 1) {
      await page.keyboard.press('Shift+ArrowLeft')
    }

    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ''))
      .toBe('palavra alvo')

    await page.keyboard.press('Control+k')

    await expect(page.locator('.bn-form-popover input').first()).toBeVisible()
    await expect(page.locator(palette)).toBeHidden()

    await page.keyboard.press('Escape')

    await page.keyboard.press('Alt+k')
    await expect(page.locator(palette)).toBeVisible()
  })

  test('documento privado de outra pessoa nunca aparece na busca', async ({
    page,
  }) => {
    const secret = 'jabuticabeira'

    await signUp(page, uniqueEmail('dono'))
    await createDocument(page, 'Segredo do dono')
    await typeInEditor(page, `combinado sobre ${secret} e mais nada`)
    await waitForSaved(page)

    await page.locator('[data-testid="user-menu-trigger"]').first().click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await page.waitForURL('**/login')

    await signUp(page, uniqueEmail('estranho'))
    await createDocument(page, 'Documento do estranho')

    await page.keyboard.press('Control+k')
    await page.locator('[data-testid="command-palette-input"]').fill(secret)

    const overlay = page.locator(palette)

    await expect(paletteList(page).getByText('Nenhum resultado')).toBeVisible()
    await expect(overlay.getByRole('option', { name: /Segredo/ })).toHaveCount(0)

    await page.locator('[data-testid="command-palette-input"]').fill('Segredo')
    await expect(overlay.getByRole('option', { name: /Segredo do dono/ })).toHaveCount(0)
  })

  test('ações rápidas criam documento e abrem o seletor de importação', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('acoes'))

    const first = await createDocument(page, 'Base')

    await page.keyboard.press('Control+k')

    const overlay = page.locator(palette)

    await expect(overlay.getByText('Ações rápidas')).toBeVisible()

    const chooser = page.waitForEvent('filechooser')

    await overlay.getByRole('option', { name: 'Importar arquivo' }).click()
    await expect(overlay).toBeHidden()
    await (await chooser).setFiles([])
    await expect(page).toHaveURL(new RegExp(`/doc/${first}$`))

    await page.keyboard.press('Control+k')
    await overlay.getByRole('option', { name: 'Novo documento' }).click()

    await page.waitForURL(
      (url) =>
        /\/doc\/[\w-]+$/.test(url.pathname) && !url.pathname.includes(first),
    )
    await expect(page.getByLabel('Título do documento')).toHaveValue('Sem título')
  })

  test('o título do documento renomeado entra na busca', async ({ page }) => {
    await signUp(page, uniqueEmail('reindex'))
    await createDocument(page, 'Nome provisório')

    await page.keyboard.press('Control+k')
    await page.locator('[data-testid="command-palette-input"]').fill('provisorio')
    await expect(
      page.locator(palette).getByRole('option', { name: /Nome provisório/ }),
    ).toBeVisible()

    await page.keyboard.press('Escape')

    const input = page.getByLabel('Título do documento')

    await input.click()
    await input.fill('Guia de metodologia')
    await input.blur()

    await page.keyboard.press('Control+k')
    await page.locator('[data-testid="command-palette-input"]').fill('metodologia')
    await expect(
      page.locator(palette).getByRole('option', { name: /Guia de metodologia/ }),
    ).toBeVisible()

    await page.locator('[data-testid="command-palette-input"]').fill('provisorio')
    await expect(paletteList(page).getByText('Nenhum resultado')).toBeVisible()
  })
})
