import { expect, test } from '@playwright/test'

import {
  createDocument,
  editorBody,
  signUp,
  uniqueEmail,
  waitForEditorReady,
} from './helpers'

async function openUserMenu(page: import('@playwright/test').Page) {
  await page.getByTestId('user-menu-trigger').first().click()
  await expect(page.getByTestId('theme-dark')).toBeVisible()
}

test.describe('theme', () => {
  test('toggles between light and dark and keeps the choice after the reload', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('theme'))

    const html = page.locator('html')

    await openUserMenu(page)
    await page.getByTestId('theme-dark').click()
    await expect(html).toHaveClass(/dark/)

    const background = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    )

    expect(background).toBe('rgb(25, 25, 25)')

    await page.reload()
    await expect(html).toHaveClass(/dark/)

    await openUserMenu(page)
    await page.getByTestId('theme-light').click()
    await expect(html).not.toHaveClass(/dark/)

    await page.reload()
    await expect(html).not.toHaveClass(/dark/)
  })

  test('the system option follows prefers-color-scheme', async ({ page }) => {
    await signUp(page, uniqueEmail('theme-system'))

    const html = page.locator('html')

    await openUserMenu(page)
    await page.getByTestId('theme-system').click()

    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(html).toHaveClass(/dark/)

    await page.emulateMedia({ colorScheme: 'light' })
    await expect(html).not.toHaveClass(/dark/)
  })

  test('the editor stays readable in the dark theme', async ({ page }) => {
    await signUp(page, uniqueEmail('theme-editor'))
    await createDocument(page)

    await openUserMenu(page)
    await page.getByTestId('theme-dark').click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    const colors = await editorBody(page).evaluate((element) => {
      const styles = getComputedStyle(element)

      return { background: styles.backgroundColor, color: styles.color }
    })

    expect(colors.color).toBe('rgb(212, 212, 212)')
    expect(colors.background).not.toBe('rgb(255, 255, 255)')
  })
})

test.describe('language', () => {
  test('switches the interface to English and keeps it after the reload', async ({
    page,
  }) => {
    await signUp(page, uniqueEmail('language'))

    await expect(
      page.getByRole('button', { name: 'Novo documento' }).first(),
    ).toBeVisible()

    await openUserMenu(page)
    await page.getByTestId('locale-en-US').click()

    await expect(
      page.getByRole('button', { name: 'New document' }).first(),
    ).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')

    await page.reload()
    await expect(
      page.getByRole('button', { name: 'New document' }).first(),
    ).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')

    await openUserMenu(page)
    await page.getByTestId('locale-pt-BR').click()

    await expect(
      page.getByRole('button', { name: 'Novo documento' }).first(),
    ).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  })

  test('the editor slash menu follows the language', async ({ page }) => {
    await signUp(page, uniqueEmail('language-editor'))
    await createDocument(page)

    await editorBody(page).click()
    await page.keyboard.type('/')
    await expect(page.getByText('Bloco de código').first()).toBeVisible()
    await page.keyboard.press('Escape')

    await openUserMenu(page)
    await page.getByTestId('locale-en-US').click()

    await expect(
      page.getByRole('button', { name: 'New document' }).first(),
    ).toBeVisible()
    await waitForEditorReady(page)

    await editorBody(page).click()
    await page.keyboard.type('/')
    await expect(page.getByText('Code block').first()).toBeVisible()
  })
})
