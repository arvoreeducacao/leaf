import { createHash, randomBytes } from 'node:crypto'

import { expect, test } from '@playwright/test'

import { signUp, uniqueEmail } from './helpers'

const redirectUri = 'https://cliente-mcp.exemplo.test/callback'

function base64url(buffer: Buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

test.describe('MCP: consentimento OAuth e aplicativos conectados', () => {
  test('autoriza um client registrado dinamicamente e revoga em Aplicativos conectados', async ({
    page,
    request,
    baseURL,
  }) => {
    await signUp(page, uniqueEmail('mcp'))

    const registration = await request.post(
      `${baseURL}/api/auth/oauth2/register`,
      {
        data: {
          client_name: 'Assistente de Teste',
          redirect_uris: [redirectUri],
          grant_types: ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          token_endpoint_auth_method: 'none',
        },
      },
    )

    expect(registration.status()).toBe(201)

    const client = (await registration.json()) as { client_id: string }
    const verifier = base64url(randomBytes(32))
    const challenge = base64url(createHash('sha256').update(verifier).digest())

    await page.route(`${redirectUri}**`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<p>callback</p>' }),
    )

    const authorize = new URL(`${baseURL}/api/auth/oauth2/authorize`)

    authorize.search = new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: redirectUri,
      scope: 'leaf:read leaf:write offline_access',
      state: 'estado-123',
      code_challenge: challenge,
      code_challenge_method: 'S256',
      resource: `${baseURL}/api/mcp`,
    }).toString()

    await page.goto(authorize.toString())

    await expect(
      page.getByRole('heading', { name: 'Permitir acesso ao Leaf?' }),
    ).toBeVisible()
    await expect(page.getByText('Assistente de Teste').first()).toBeVisible()
    await expect(page.getByText('cliente-mcp.exemplo.test')).toBeVisible()
    await expect(
      page.getByText('Criar páginas e editar as páginas que você pode editar'),
    ).toBeVisible()

    const callbackRequest = page.waitForRequest((request) =>
      request.url().startsWith(redirectUri),
    )

    await page.getByRole('button', { name: 'Permitir' }).click()

    const callback = new URL((await callbackRequest).url())

    expect(callback.searchParams.get('code')).toBeTruthy()
    expect(callback.searchParams.get('state')).toBe('estado-123')

    await page.goto('/connected-apps')

    await expect(
      page.getByRole('heading', { name: 'Aplicativos conectados' }),
    ).toBeVisible()
    await expect(page.getByText('Assistente de Teste')).toBeVisible()

    await page
      .getByRole('button', { name: 'Revogar acesso de Assistente de Teste' })
      .click()
    await page.getByRole('button', { name: 'Revogar acesso', exact: true }).click()

    await expect(page.getByText('Acesso revogado')).toBeVisible()
    await expect(page.getByText('Nenhum aplicativo conectado ainda')).toBeVisible()

    await page.goto(authorize.toString())
    await expect(
      page.getByRole('heading', { name: 'Permitir acesso ao Leaf?' }),
    ).toBeVisible()
  })

  test('negar devolve access_denied para o client', async ({
    page,
    request,
    baseURL,
  }) => {
    await signUp(page, uniqueEmail('mcp-nega'))

    const registration = await request.post(
      `${baseURL}/api/auth/oauth2/register`,
      {
        data: {
          client_name: 'Cliente Negado',
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: 'none',
        },
      },
    )
    const client = (await registration.json()) as { client_id: string }

    await page.route(`${redirectUri}**`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<p>callback</p>' }),
    )

    const authorize = new URL(`${baseURL}/api/auth/oauth2/authorize`)

    authorize.search = new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: redirectUri,
      scope: 'leaf:read',
      code_challenge: base64url(createHash('sha256').update('v').digest()),
      code_challenge_method: 'S256',
    }).toString()

    await page.goto(authorize.toString())
    const callbackRequest = page.waitForRequest((request) =>
      request.url().startsWith(redirectUri),
    )

    await page.getByRole('button', { name: 'Negar' }).click()

    const callback = new URL((await callbackRequest).url())

    expect(callback.searchParams.get('error')).toBe('access_denied')
  })
})
