import { describe, expect, it } from 'vitest'

import { validateDynamicClientRegistration } from '@/lib/mcp/client-registration'

const base = {
  client_name: 'Claude',
  redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
  grant_types: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_method: 'none',
}

describe('dynamic client registration', () => {
  it('accepts a public client with an https redirect and forces application_type web', () => {
    const decision = validateDynamicClientRegistration(base)

    expect(decision.ok).toBe(true)

    if (decision.ok) {
      expect(decision.body.token_endpoint_auth_method).toBe('none')
      expect(decision.body.application_type).toBe('web')
    }
  })

  it('accepts http loopback for command line clients as native', () => {
    const decision = validateDynamicClientRegistration({
      ...base,
      redirect_uris: ['http://localhost:6274/oauth/callback', 'http://127.0.0.1:8123/cb'],
    })

    expect(decision.ok).toBe(true)

    if (decision.ok) {
      expect(decision.body.application_type).toBe('native')
    }
  })

  it('refuses an http redirect outside the loopback', () => {
    const decision = validateDynamicClientRegistration({
      ...base,
      redirect_uris: ['http://exemplo.com/callback'],
    })

    expect(decision).toMatchObject({ ok: false, error: 'invalid_redirect_uri' })
  })

  it('refuses a custom scheme and mixing https with loopback', () => {
    expect(
      validateDynamicClientRegistration({
        ...base,
        redirect_uris: ['cursor://anysphere.cursor-mcp/callback'],
      }),
    ).toMatchObject({ ok: false, error: 'invalid_redirect_uri' })

    expect(
      validateDynamicClientRegistration({
        ...base,
        redirect_uris: ['https://claude.ai/cb', 'http://localhost:1234/cb'],
      }),
    ).toMatchObject({ ok: false, error: 'invalid_redirect_uri' })
  })

  it('registers a client that asked for a secret as a public one', () => {
    const decision = validateDynamicClientRegistration({
      ...base,
      token_endpoint_auth_method: 'client_secret_post',
    })

    expect(decision.ok).toBe(true)

    if (decision.ok) {
      expect(decision.body.token_endpoint_auth_method).toBe('none')
    }
  })

  it('refuses a client carrying its own client_secret', () => {
    expect(
      validateDynamicClientRegistration({ ...base, client_secret: 'segredo' }),
    ).toMatchObject({ ok: false, error: 'invalid_client_metadata' })
  })

  it('assumes a public client when the authentication method is omitted', () => {
    const { token_endpoint_auth_method: _omitted, ...withoutMethod } = base
    const decision = validateDynamicClientRegistration(withoutMethod)

    expect(decision.ok).toBe(true)

    if (decision.ok) {
      expect(decision.body.token_endpoint_auth_method).toBe('none')
    }
  })

  it('refuses grants other than authorization_code and refresh_token', () => {
    expect(
      validateDynamicClientRegistration({
        ...base,
        grant_types: ['client_credentials'],
      }),
    ).toMatchObject({ ok: false, error: 'invalid_client_metadata' })
  })

  it('exige redirect_uris', () => {
    expect(
      validateDynamicClientRegistration({ ...base, redirect_uris: [] }),
    ).toMatchObject({ ok: false, error: 'invalid_redirect_uri' })
  })
})
