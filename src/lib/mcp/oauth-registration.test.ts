import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { resetDatabase } from '@/db/testing'
import { authIssuer } from '@/lib/mcp-config'

let handler: (request: Request) => Promise<Response>

beforeAll(async () => {
  vi.stubEnv('LEAF_MCP_ENABLED', '1')

  const { auth } = await import('@/lib/auth')

  handler = auth.handler
})

beforeEach(async () => {
  await resetDatabase()
})

function register(body: Record<string, unknown>) {
  return handler(
    new Request(`${authIssuer()}/api/auth/oauth2/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

const publicClient = {
  client_name: 'Claude',
  redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
  grant_types: ['authorization_code', 'refresh_token'],
  response_types: ['code'],
  token_endpoint_auth_method: 'none',
}

describe('registro dinâmico via better-auth', () => {
  it('registra client público sem devolver client_secret e ligado ao resource do MCP', async () => {
    const response = await register(publicClient)
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(201)
    expect(body.client_id).toEqual(expect.any(String))
    expect(body.client_secret).toBeUndefined()
    expect(body.token_endpoint_auth_method).toBe('none')
    expect(body.scope).toBe('leaf:read leaf:write offline_access')
  })

  it('recusa redirect http fora do loopback', async () => {
    const response = await register({
      ...publicClient,
      redirect_uris: ['http://exemplo.com/callback'],
    })
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_redirect_uri')
  })

  it('recusa client confidencial', async () => {
    const response = await register({
      ...publicClient,
      token_endpoint_auth_method: 'client_secret_basic',
    })
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_client_metadata')
  })

  it('publica o documento do authorization server com PKCE S256 e registro dinâmico', async () => {
    const response = await handler(
      new Request(`${authIssuer()}/.well-known/oauth-authorization-server`),
    )
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body.issuer).toBe(authIssuer())
    expect(body.registration_endpoint).toBe(`${authIssuer()}/api/auth/oauth2/register`)
    expect(body.code_challenge_methods_supported).toEqual(['S256'])
    expect(body.scopes_supported).toEqual(['leaf:read', 'leaf:write', 'offline_access'])
    expect(body.token_endpoint_auth_methods_supported).toContain('none')
  })
})
