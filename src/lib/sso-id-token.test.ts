import {
  SignJWT,
  UnsecuredJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
} from 'jose'
import { beforeAll, describe, expect, it } from 'vitest'

import { type SsoIdTokenPolicy, verifySsoIdToken } from '@/lib/sso-id-token'

const kid = 'provider-key'
const issuer = 'https://auth.example.com'
const audience = 'leaf-client'

let providerKey: CryptoKey
let otherKey: CryptoKey
let policy: SsoIdTokenPolicy

beforeAll(async () => {
  const provider = await generateKeyPair('RS256', { extractable: true })
  const other = await generateKeyPair('RS256', { extractable: true })

  providerKey = provider.privateKey
  otherKey = other.privateKey

  policy = {
    keys: createLocalJWKSet({
      keys: [{ ...(await exportJWK(provider.publicKey)), kid, alg: 'RS256', use: 'sig' }],
    }),
    issuer,
    audience,
  }
})

type Claims = Readonly<{
  iss?: string
  aud?: string
  exp?: string
  sub?: string
  email?: string
  key?: CryptoKey
}>

function idToken(claims: Claims = {}) {
  const payload: Record<string, unknown> = { email: 'pessoa@example.com' }

  if ('email' in claims) {
    payload.email = claims.email
  }

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(claims.iss ?? issuer)
    .setAudience(claims.aud ?? audience)
    .setSubject(claims.sub ?? 'subject-1')
    .setIssuedAt()
    .setExpirationTime(claims.exp ?? '10m')
    .sign(claims.key ?? providerKey)
}

describe('verifySsoIdToken', () => {
  it('returns the profile of a token signed by the provider for this client', async () => {
    const profile = await verifySsoIdToken(await idToken(), policy)

    expect(profile).toMatchObject({
      id: 'subject-1',
      sub: 'subject-1',
      email: 'pessoa@example.com',
      emailVerified: false,
    })
  })

  it('refuses a token signed by a key the provider does not publish', async () => {
    expect(await verifySsoIdToken(await idToken({ key: otherKey }), policy)).toBeNull()
  })

  it('refuses an unsigned token', async () => {
    const unsigned = new UnsecuredJWT({ email: 'pessoa@example.com' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject('subject-1')
      .setExpirationTime('10m')
      .encode()

    expect(await verifySsoIdToken(unsigned, policy)).toBeNull()
  })

  it('refuses a token from another issuer', async () => {
    expect(
      await verifySsoIdToken(await idToken({ iss: 'https://other.example.com' }), policy),
    ).toBeNull()
  })

  it('refuses a token issued to another audience', async () => {
    expect(await verifySsoIdToken(await idToken({ aud: 'other-client' }), policy)).toBeNull()
  })

  it('refuses an expired token', async () => {
    const token = await idToken({ exp: '1m' })
    const later = new Date(Date.now() + 5 * 60_000)

    expect(await verifySsoIdToken(token, policy, later)).toBeNull()
  })

  it('refuses a token with no email or no subject', async () => {
    expect(await verifySsoIdToken(await idToken({ email: '' }), policy)).toBeNull()
    expect(await verifySsoIdToken(await idToken({ sub: '' }), policy)).toBeNull()
  })

  it('refuses a malformed token and a missing one', async () => {
    expect(await verifySsoIdToken('not-a-jwt', policy)).toBeNull()
    expect(await verifySsoIdToken(undefined, policy)).toBeNull()
  })
})
