import { expect, test } from '@playwright/test'

test.describe('login apenas com Google', () => {
  test('a tela de login não tem email e senha', async ({ page }) => {
    await page.goto('/login')

    await expect(
      page.getByRole('button', { name: 'Entrar com Google' }),
    ).toBeVisible()
    await expect(page.getByText('Use sua conta @arvore.com.br')).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveCount(0)
    await expect(page.getByLabel('Senha')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Criar conta' })).toHaveCount(0)
  })

  test('/signup manda para /login', async ({ page }) => {
    await page.goto('/signup')

    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole('button', { name: 'Entrar com Google' }),
    ).toBeVisible()
  })

  test('o botão leva para o consentimento do Google', async ({ page }) => {
    await page.route('https://accounts.google.com/**', (route) =>
      route.fulfill({
        body: '<html lang="pt-BR"><body>consentimento</body></html>',
        contentType: 'text/html',
      }),
    )

    await page.goto('/login')
    await page.getByRole('button', { name: 'Entrar com Google' }).click()

    await page.waitForURL(/accounts\.google\.com/)

    const target = new URL(page.url())

    expect(target.searchParams.get('client_id')).toBe(
      'leaf-e2e-google-client-id.apps.googleusercontent.com',
    )
    expect(target.searchParams.get('hd')).toBe('arvore.com.br')
    expect(target.searchParams.get('redirect_uri')).toContain(
      '/api/auth/callback/google',
    )
  })

  test('erro de domínio negado volta com mensagem na tela de login', async ({
    page,
  }) => {
    await page.goto('/login?error=EMAIL_DOMAIN_NOT_ALLOWED')

    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Use seu email @arvore.com.br para entrar no Leaf.' }),
    ).toBeVisible()
  })

  test('erro genérico do callback também aterrissa no login', async ({
    page,
  }) => {
    await page.goto('/login?error=access_denied')

    await expect(
      page.getByRole('alert').filter({
        hasText: 'Não foi possível entrar com o Google. Tente de novo.',
      }),
    ).toBeVisible()
  })
})
