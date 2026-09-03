import { describe, expect, it } from 'vitest'

import { validateDynamicClientRegistration } from '@/lib/mcp/client-registration'

const base = {
  client_name: 'Claude',
  redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
  grant_types: ['authorization_code', 'refresh_token'],
  token_endpoint_auth_method: 'none',
}

describe('registro dinâmico de clients', () => {
  it('aceita client público com redirect https e força application_type web', () => {
    const decision = validateDynamicClientRegistration(base)

    expect(decision.ok).toBe(true)

    if (decision.ok) {
      expect(decision.body.token_endpoint_auth_method).toBe('none')
      expect(decision.body.application_type).toBe('web')
    }
  })

  it('aceita loopback http para clientes de linha de comando como native', () => {
    const decision = validateDynamicClientRegistration({
      ...base,
      redirect_uris: ['http://localhost:6274/oauth/callback', 'http://127.0.0.1:8123/cb'],
    })

    expect(decision.ok).toBe(true)

    if (decision.ok) {
      expect(decision.body.application_type).toBe('native')
    }
  })

  it('recusa redirect http fora do loopback', () => {
    const decision = validateDynamicClientRegistration({
      ...base,
      redirect_uris: ['http://exemplo.com/callback'],
    })

    expect(decision).toMatchObject({ ok: false, error: 'invalid_redirect_uri' })
  })

  it('recusa esquema customizado e mistura de https com loopback', () => {
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

  it('recusa client confidencial ou com client_secret', () => {
    expect(
      validateDynamicClientRegistration({
        ...base,
        token_endpoint_auth_method: 'client_secret_basic',
      }),
    ).toMatchObject({ ok: false, error: 'invalid_client_metadata' })

    expect(
      validateDynamicClientRegistration({ ...base, client_secret: 'segredo' }),
    ).toMatchObject({ ok: false, error: 'invalid_client_metadata' })
  })

  it('assume client público quando o método de autenticação é omitido', () => {
    const { token_endpoint_auth_method: _omitted, ...withoutMethod } = base
    const decision = validateDynamicClientRegistration(withoutMethod)

    expect(decision.ok).toBe(true)

    if (decision.ok) {
      expect(decision.body.token_endpoint_auth_method).toBe('none')
    }
  })

  it('recusa grants fora de authorization_code e refresh_token', () => {
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
