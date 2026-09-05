import { expect, test } from '@playwright/test'

const issuer = 'https://auth.e2e.invalid/oidc'

test.describe('sign-in through the configured SSO', () => {
  test('the login screen has no email and password', async ({ page }) => {
    await page.goto('/login')

    await expect(page.getByRole('button', { name: 'Acme' })).toBeVisible()
    await expect(page.getByText('Use sua conta @example.com')).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveCount(0)
    await expect(page.getByLabel('Senha')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Criar conta' })).toHaveCount(0)
  })

  test('the passkey is offered next to the SSO', async ({ page }) => {
    await page.goto('/login')

    await expect(
      page.getByRole('button', { name: 'Chave de acesso' }),
    ).toBeVisible()
  })

  test('/signup sends to /login', async ({ page }) => {
    await page.goto('/signup')

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: 'Acme' })).toBeVisible()
  })

  test('the button leads to the SSO authorize with PKCE', async ({ page }) => {
    await page.route('https://auth.e2e.invalid/**', (route) =>
      route.fulfill({
        body: '<html lang="pt-BR"><body>login</body></html>',
        contentType: 'text/html',
      }),
    )

    await page.goto('/login')
    await page.getByRole('button', { name: 'Acme' }).click()

    await page.waitForURL(/auth\.e2e\.invalid/)

    const target = new URL(page.url())

    expect(`${target.origin}${target.pathname}`).toBe(`${issuer}/oauth2/authorize`)
    expect(target.searchParams.get('response_type')).toBe('code')
    expect(target.searchParams.get('client_id')).toBe('leaf-e2e')
    expect(target.searchParams.get('scope')).toBe('openid profile email')
    expect(target.searchParams.get('redirect_uri')).toContain(
      '/api/auth/callback/sso',
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
      page.getByRole('alert').filter({
        hasText:
          'A conta que você usou não é @example.com. Entre com outra conta para usar o Leaf.',
      }),
    ).toBeVisible()
  })

  test('a generic callback error also lands on the login', async ({ page }) => {
    await page.goto('/login?error=access_denied')

    await expect(
      page.getByRole('alert').filter({
        hasText: 'Não foi possível entrar. Tente de novo.',
      }),
    ).toBeVisible()
  })
})
