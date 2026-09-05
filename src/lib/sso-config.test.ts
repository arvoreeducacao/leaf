import { describe, expect, it } from 'vitest'

import { googleConfig, ssoConfig } from '@/lib/sso-config'

const credentials = {
  LEAF_SSO_CLIENT_ID: 'leaf',
  LEAF_SSO_ISSUER: 'https://auth.example.com/oidc',
}

describe('ssoConfig', () => {
  it('stays off without a client id', () => {
    expect(ssoConfig({ LEAF_SSO_ISSUER: credentials.LEAF_SSO_ISSUER })).toBeNull()
  })

  it('stays off without an issuer', () => {
    expect(
      ssoConfig({ LEAF_SSO_CLIENT_ID: credentials.LEAF_SSO_CLIENT_ID }),
    ).toBeNull()
  })

  it('derives the endpoints from the issuer', () => {
    expect(ssoConfig(credentials)).toEqual({
      authorizationUrl: 'https://auth.example.com/oidc/oauth2/authorize',
      clientId: 'leaf',
      clientSecret: undefined,
      issuer: 'https://auth.example.com/oidc',
      logoutUrl: null,
      providerId: 'sso',
      providerName: 'SSO',
      tokenUrl: 'https://auth.example.com/oidc/oauth2/token',
    })
  })

  it('drops the trailing slash of the issuer', () => {
    expect(
      ssoConfig({ ...credentials, LEAF_SSO_ISSUER: 'https://auth.example.com/oidc/' })
        ?.tokenUrl,
    ).toBe('https://auth.example.com/oidc/oauth2/token')
  })

  it('takes the endpoints, the id and the name when they are given', () => {
    expect(
      ssoConfig({
        ...credentials,
        LEAF_SSO_AUTHORIZATION_URL: 'https://auth.example.com/authorize',
        LEAF_SSO_CLIENT_SECRET: 'secret',
        LEAF_SSO_LOGOUT_URL: 'https://auth.example.com/logout',
        LEAF_SSO_PROVIDER_ID: 'acme',
        LEAF_SSO_PROVIDER_NAME: 'Acme',
        LEAF_SSO_TOKEN_URL: 'https://auth.example.com/token',
      }),
    ).toEqual({
      authorizationUrl: 'https://auth.example.com/authorize',
      clientId: 'leaf',
      clientSecret: 'secret',
      issuer: 'https://auth.example.com/oidc',
      logoutUrl: 'https://auth.example.com/logout',
      providerId: 'acme',
      providerName: 'Acme',
      tokenUrl: 'https://auth.example.com/token',
    })
  })
})

describe('googleConfig', () => {
  it('needs both halves of the credential', () => {
    expect(googleConfig({ GOOGLE_CLIENT_ID: 'id' })).toBeNull()
    expect(googleConfig({ GOOGLE_CLIENT_SECRET: 'secret' })).toBeNull()
    expect(googleConfig({ GOOGLE_CLIENT_ID: ' ', GOOGLE_CLIENT_SECRET: 's' })).toBeNull()
  })

  it('reads the credential', () => {
    expect(
      googleConfig({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' }),
    ).toEqual({ clientId: 'id', clientSecret: 'secret' })
  })
})
