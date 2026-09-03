import { expect, test } from '@playwright/test'

const issuer = 'https://auth.e2e.invalid/api-arvore'

test.describe('sign-in through the Árvore SSO', () => {
  test('the login screen has no email and password', async ({ page }) => {
    await page.goto('/login')

    await expect(
      page.getByRole('button', { name: 'Entrar com a conta Árvore' }),
    ).toBeVisible()
    await expect(page.getByText('Use sua conta @arvore.com.br')).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveCount(0)
    await expect(page.getByLabel('Senha')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Criar conta' })).toHaveCount(0)
  })

  test('/signup sends to /login', async ({ page }) => {
    await page.goto('/signup')

    await expect(page).toHaveURL(/\/login$/)
    await expect(
      page.getByRole('button', { name: 'Entrar com a conta Árvore' }),
    ).toBeVisible()
  })

  test('the button leads to the SSO authorize with PKCE', async ({ page }) => {
    await page.route('https://auth.e2e.invalid/**', (route) =>
      route.fulfill({
        body: '<html lang="pt-BR"><body>Árvore login</body></html>',
        contentType: 'text/html',
      }),
    )

    await page.goto('/login')
    await page.getByRole('button', { name: 'Entrar com a conta Árvore' }).click()

    await page.waitForURL(/auth\.e2e\.invalid/)

    const target = new URL(page.url())

    expect(`${target.origin}${target.pathname}`).toBe(`${issuer}/oauth2/authorize`)
    expect(target.searchParams.get('response_type')).toBe('code')
    expect(target.searchParams.get('client_id')).toBe('leaf-e2e')
    expect(target.searchParams.get('scope')).toBe('openid profile email')
    expect(target.searchParams.get('redirect_uri')).toContain(
      '/api/auth/callback/arvore',
    )
    expect(target.searchParams.get('code_challenge_method')).toBe('S256')
    expect(target.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/)
    expect(target.searchParams.get('state')).toBeTruthy()
  })

  test('a denied domain error comes back with a message on the login screen', async ({
    page,
  }) => {
    await page.goto('/login?error=EMAIL_DOMAIN_NOT_ALLOWED')

    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Use seu email @arvore.com.br para entrar no Leaf.' }),
    ).toBeVisible()
  })

  test('a generic callback error also lands on the login', async ({
    page,
  }) => {
    await page.goto('/login?error=access_denied')

    await expect(
      page.getByRole('alert').filter({
        hasText: 'Não foi possível entrar com a conta Árvore. Tente de novo.',
      }),
    ).toBeVisible()
  })
})
