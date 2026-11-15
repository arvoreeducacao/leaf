import { SignJWT, exportJWK, generateKeyPair } from 'jose'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

const origin = 'https://auth.example.com'
const issuerUrl = `${origin}/provider`
const jwksUrl = `${issuerUrl}/oauth2/jwks`
const kid = 'provider-key'

type SsoProvider = Readonly<{
  getUserInfo: (tokens: { idToken?: string; accessToken?: string }) => Promise<{
    user: { email?: string | null; name?: string; emailVerified: boolean }
    data: Record<string, unknown>
  } | null>
  accountSubject: (input: { tokens: object; profile: object }) => string
}>

let providerKey: CryptoKey
let otherKey: CryptoKey
let sso: SsoProvider
let originalFetch: typeof fetch

async function idToken(claims: { iss?: string; aud?: string; key?: CryptoKey } = {}) {
  return new SignJWT({ email: 'person@example.com' })
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(claims.iss ?? origin)
    .setAudience(claims.aud ?? origin)
    .setSubject('identity-subject-1')
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(claims.key ?? providerKey)
}

beforeAll(async () => {
  const provider = await generateKeyPair('RS256', { extractable: true })
  const other = await generateKeyPair('RS256', { extractable: true })

  providerKey = provider.privateKey
  otherKey = other.privateKey

  const published = {
    keys: [{ ...(await exportJWK(provider.publicKey)), kid, alg: 'RS256', use: 'sig' }],
  }

  originalFetch = globalThis.fetch
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : String(input)

    return url === jwksUrl
      ? Response.json(published)
      : originalFetch(input, init)
  })

  vi.stubEnv('BETTER_AUTH_SECRET', 'leaf-test-secret-with-thirty-two-chars')
  vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000')
  vi.stubEnv('LEAF_SSO_CLIENT_ID', 'leaf-client')
  vi.stubEnv('LEAF_SSO_CLIENT_SECRET', 'test-client-secret')
  vi.stubEnv('LEAF_SSO_ISSUER', issuerUrl)
  vi.stubEnv('LEAF_SSO_PROVIDER_ID', 'sso')
  vi.stubEnv('LEAF_SSO_ID_TOKEN_ISSUER', origin)
  vi.stubEnv('LEAF_SSO_ID_TOKEN_AUDIENCE', origin)
  vi.resetModules()

  const { auth } = await import('@/lib/auth')
  const context = await auth.$context
  const found = context.socialProviders.find((candidate) => candidate.id === 'sso')

  if (!found) {
    throw new Error('the SSO provider was not registered')
  }

  sso = found as unknown as SsoProvider
})

afterAll(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('the SSO provider as registered in auth', () => {
  it('signs in with a token shaped like the central provider: path-style endpoints, issuer and audience at the origin, no name, no email_verified', async () => {
    const info = await sso.getUserInfo({ idToken: await idToken() })

    expect(info?.user.email).toBe('person@example.com')
    expect(info?.user.name).toBe('person')
    expect(info?.user.emailVerified).toBe(true)
    expect(sso.accountSubject({ tokens: {}, profile: info?.data ?? {} })).toBe(
      'identity-subject-1',
    )
  })

  it('refuses a token signed with a key the provider does not publish', async () => {
    expect(await sso.getUserInfo({ idToken: await idToken({ key: otherKey }) })).toBeNull()
  })

  it('refuses a token whose issuer or audience is not the configured one', async () => {
    expect(await sso.getUserInfo({ idToken: await idToken({ iss: issuerUrl }) })).toBeNull()
    expect(await sso.getUserInfo({ idToken: await idToken({ aud: 'leaf-client' }) })).toBeNull()
  })

  it('refuses a response with no id_token', async () => {
    expect(await sso.getUserInfo({ accessToken: 'opaque' })).toBeNull()
  })
})
