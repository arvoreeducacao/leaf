import { beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { resetDatabase } from '@/db/testing'
import { authIssuer } from '@/lib/mcp-config'

let handler: (request: Request) => Promise<Response>

beforeAll(async () => {
  vi.stubEnv('LEAF_MCP_ENABLED', '1')

  await resetDatabase()

  const { auth } = await import('@/lib/auth')

  handler = auth.handler
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

describe('dynamic registration through better-auth', () => {
  it('registers a public client without returning a client_secret, bound to the MCP resource', async () => {
    const response = await register(publicClient)
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(201)
    expect(body.client_id).toEqual(expect.any(String))
    expect(body.client_secret).toBeUndefined()
    expect(body.token_endpoint_auth_method).toBe('none')
    expect(body.scope).toBe('leaf:read leaf:write offline_access')
  })

  it('refuses an http redirect outside the loopback', async () => {
    const response = await register({
      ...publicClient,
      redirect_uris: ['http://exemplo.com/callback'],
    })
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(400)
    expect(body.error).toBe('invalid_redirect_uri')
  })

  it('registers a client that asked for a secret as a public one, without a secret', async () => {
    const response = await register({
      ...publicClient,
      token_endpoint_auth_method: 'client_secret_post',
    })
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(201)
    expect(body.client_secret).toBeUndefined()
    expect(body.token_endpoint_auth_method).toBe('none')
  })

  it('publishes the authorization server document with PKCE S256, dynamic registration and public clients only', async () => {
    const { authorizationServerMetadataResponse } = await import(
      '@/lib/mcp/discovery'
    )
    const response = await authorizationServerMetadataResponse(
      new Request(`${authIssuer()}/.well-known/oauth-authorization-server`),
    )
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(body.issuer).toBe(authIssuer())
    expect(body.registration_endpoint).toBe(`${authIssuer()}/api/auth/oauth2/register`)
    expect(body.code_challenge_methods_supported).toEqual(['S256'])
    expect(body.scopes_supported).toEqual(['leaf:read', 'leaf:write', 'offline_access'])
    expect(body.token_endpoint_auth_methods_supported).toEqual(['none'])
  })
})
