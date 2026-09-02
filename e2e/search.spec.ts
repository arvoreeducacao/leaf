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

test.describe('search and command palette', () => {
  test('the shortcut opens the palette, the document text is found and Enter navigates', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('palette'))

    const minutes = await createDocument(page, 'Meeting minutes')

    await typeInEditor(page, 'we agreed on the schedule of the term')
    await waitForSaved(page)

    const plan = await createDocument(page, 'Reading plan')

    await typeInEditor(page, 'the résumé of basic education asks for assessment')
    await waitForSaved(page)

    await page.keyboard.press('Control+k')

    const overlay = page.locator(palette)

    await expect(overlay).toBeVisible()
    await expect(overlay.getByText('Recentes')).toBeVisible()
    await expect(overlay.getByRole('option', { name: /Reading plan/ })).toBeVisible()
    await expect(overlay.getByRole('option', { name: /Meeting minutes/ })).toBeVisible()

    await page.locator('[data-testid="command-palette-input"]').fill('resume')

    await expect(overlay.getByText('Documentos')).toBeVisible()
    await expect(
      overlay.getByRole('option', { name: /Meeting minutes/ }),
    ).toHaveCount(0)

    const hit = overlay.getByRole('option', { name: /Reading plan/ })

    await expect(hit).toBeVisible()
    await expect(hit).toContainText('résumé')

    await page.goto(`/doc/${minutes}`)
    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Meeting minutes',
    )

    await page.keyboard.press('Control+k')
    await page.locator('[data-testid="command-palette-input"]').fill('assessment')
    await expect(
      page.locator(palette).getByRole('option', { name: /Reading plan/ }),
    ).toBeVisible()
    await page.keyboard.press('Enter')

    await page.waitForURL(`**/doc/${plan}`)
    await expect(page.getByLabel('Título do documento')).toHaveValue(
      'Reading plan',
    )
  })

  test('arrows move the selection, Esc closes and the shortcut toggles', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('keyboard'))
    await createDocument(page, 'Document one')
    await createDocument(page, 'Document two')

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

  test('with a selection in the editor Ctrl+K is the link and Alt+K still opens the palette', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('precedence'))
    await createDocument(page, 'Precedence')

    await typeInEditor(page, 'target word')

    for (let index = 0; index < 'target word'.length; index += 1) {
      await page.keyboard.press('Shift+ArrowLeft')
    }

    await expect
      .poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ''))
      .toBe('target word')

    await page.keyboard.press('Control+k')

    await expect(page.locator('.bn-form-popover input').first()).toBeVisible()
    await expect(page.locator(palette)).toBeHidden()

    await page.keyboard.press('Escape')

    await page.keyboard.press('Alt+k')
    await expect(page.locator(palette)).toBeVisible()
  })

  test('a private document of someone else never shows up in the search', async ({
    page,
  }) => {
    const secret = 'flibbertigibbet'

    await signUp(page, uniqueEmail('owner'))
    await createDocument(page, 'Owner secret')
    await typeInEditor(page, `agreed about ${secret} and nothing else`)
    await waitForSaved(page)

    await page.locator('[data-testid="user-menu-trigger"]').first().click()
    await page.getByRole('menuitem', { name: 'Sair' }).click()
    await page.waitForURL('**/login')

    await signUp(page, uniqueEmail('stranger'))
    await createDocument(page, 'Stranger document')

    await page.keyboard.press('Control+k')
    await page.locator('[data-testid="command-palette-input"]').fill(secret)

    const overlay = page.locator(palette)

    await expect(paletteList(page).getByText('Nenhum resultado')).toBeVisible()
    await expect(overlay.getByRole('option', { name: /secret/i })).toHaveCount(0)

    await page.locator('[data-testid="command-palette-input"]').fill('secret')
    await expect(overlay.getByRole('option', { name: /Owner secret/ })).toHaveCount(0)
  })

  test('quick actions create a document and open the import picker', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('actions'))

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

  test('the renamed document title enters the search', async ({ page }) => {
    await signUp(page, uniqueEmail('reindex'))
    await createDocument(page, 'Temporary name')

    await page.keyboard.press('Control+k')
    await page.locator('[data-testid="command-palette-input"]').fill('temporary')
    await expect(
      page.locator(palette).getByRole('option', { name: /Temporary name/ }),
    ).toBeVisible()

    await page.keyboard.press('Escape')

    const input = page.getByLabel('Título do documento')

    await input.click()
    await input.fill('Methodology guide')
    await input.blur()

    await page.keyboard.press('Control+k')
    await page.locator('[data-testid="command-palette-input"]').fill('methodology')
    await expect(
      page.locator(palette).getByRole('option', { name: /Methodology guide/ }),
    ).toBeVisible()

    await page.locator('[data-testid="command-palette-input"]').fill('temporary')
    await expect(paletteList(page).getByText('Nenhum resultado')).toBeVisible()
  })
})
