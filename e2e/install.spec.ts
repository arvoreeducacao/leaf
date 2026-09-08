import { devices, expect, test } from '@playwright/test'

import { signUp, uniqueEmail } from './helpers'

const installPrompt = `
(function () {
  const event = new Event('beforeinstallprompt');
  event.prompt = function () { return Promise.resolve() };
  event.userChoice = Promise.resolve({ outcome: 'dismissed' });
  window.dispatchEvent(event);
})();
`

test.describe('install on Android, where the browser hands the prompt over', () => {
  test('the banner offers the install and dismissing it is final', async ({ page }) => {
    await signUp(page, uniqueEmail('install-android'))
    await page.evaluate(installPrompt)

    const banner = page.getByTestId('install-banner')

    await expect(banner).toBeVisible()

    await banner.getByRole('button', { name: 'Dispensar' }).click()
    await expect(banner).toBeHidden()

    await page.reload()
    await page.evaluate(installPrompt)
    await expect(banner).toBeHidden()

    await page.getByRole('button', { name: 'Abrir navegação' }).click()

    const nav = page.getByRole('dialog')

    await nav.getByTestId('user-menu-trigger').click()

    await expect(page.getByTestId('install-app')).toBeVisible()
  })
})

test.describe('install on the iPhone, where the browser never offers a prompt', () => {
  test.use({ userAgent: devices['iPhone 13'].userAgent })

  test('the banner teaches the home screen instead of promising an install', async ({ page }) => {
    await signUp(page, uniqueEmail('install-ios'))

    const banner = page.getByTestId('install-banner')

    await expect(banner).toBeVisible()

    await banner.getByRole('button', { name: 'Instalar' }).click()

    await expect(page.getByText('Adicione o Leaf à Tela de Início')).toBeVisible()
    await expect(page.getByText('Toque em Compartilhar, na barra de baixo')).toBeVisible()
    await expect(page.getByText('Escolha "Adicionar à Tela de Início"')).toBeVisible()
  })
})
