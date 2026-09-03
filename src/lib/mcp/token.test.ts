import { SignJWT, exportJWK, generateKeyPair } from 'jose'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { db } from '@/db'
import { jwks } from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { authIssuer, mcpResourceUrl } from '@/lib/mcp-config'
import { resetMcpKeyCache, verifyMcpAccessToken } from '@/lib/mcp/token'

type Keys = Awaited<ReturnType<typeof generateKeyPair>>

let signing: Keys
let foreign: Keys

const kid = 'jwk-leaf'

beforeAll(async () => {
  signing = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true })
  foreign = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true })
})

beforeEach(async () => {
  await resetDatabase()
  resetMcpKeyCache()

  await db.insert(jwks).values({
    id: kid,
    publicKey: JSON.stringify(await exportJWK(signing.publicKey)),
    privateKey: 'nao-usado-no-teste',
    alg: 'EdDSA',
    crv: 'Ed25519',
    createdAt: new Date(),
  })
})

type Claims = Readonly<{
  iss?: string
  aud?: string
  sub?: string
  scope?: string
  client_id?: string
  expiresIn?: string
  typ?: string
  key?: Keys['privateKey']
  alg?: 'EdDSA' | 'RS256'
  kid?: string
}>

async function mint(overrides: Claims = {}) {
  const builder = new SignJWT({
    scope: overrides.scope ?? 'leaf:read leaf:write offline_access',
    client_id: overrides.client_id ?? 'client-claude',
  })
    .setProtectedHeader({
      alg: overrides.alg ?? 'EdDSA',
      kid: overrides.kid ?? kid,
      typ: overrides.typ ?? 'at+jwt',
    })
    .setIssuer(overrides.iss ?? authIssuer())
    .setAudience(overrides.aud ?? mcpResourceUrl())
    .setSubject(overrides.sub ?? 'user-1')
    .setIssuedAt()
    .setExpirationTime(overrides.expiresIn ?? '15m')
    .setJti('jti-1')

  return builder.sign(overrides.key ?? signing.privateKey)
}

describe('verificação do access token do MCP', () => {
  it('aceita um token assinado pela chave do Leaf com iss, aud e typ certos', async () => {
    const result = await verifyMcpAccessToken(await mint())

    expect(result.status).toBe('ok')

    if (result.status === 'ok') {
      expect(result.access.userId).toBe('user-1')
      expect(result.access.clientId).toBe('client-claude')
      expect(result.access.scopes).toEqual(['leaf:read', 'leaf:write', 'offline_access'])
    }
  })

  it('recusa assinatura de outra chave', async () => {
    const token = await mint({ key: foreign.privateKey })

    expect(await verifyMcpAccessToken(token)).toEqual({ status: 'invalid' })
  })

  it('recusa kid desconhecido mesmo com assinatura válida', async () => {
    const token = await mint({ kid: 'outra-chave' })

    expect(await verifyMcpAccessToken(token)).toEqual({ status: 'invalid' })
  })

  it('recusa token expirado', async () => {
    const token = await mint({ expiresIn: '-1m' })

    expect(await verifyMcpAccessToken(token)).toEqual({ status: 'invalid' })
  })

  it('recusa issuer diferente', async () => {
    const token = await mint({ iss: 'https://outro.exemplo.org' })

    expect(await verifyMcpAccessToken(token)).toEqual({ status: 'invalid' })
  })

  it('recusa audience de outro resource', async () => {
    const token = await mint({ aud: `${authIssuer()}/api/outra-coisa` })

    expect(await verifyMcpAccessToken(token)).toEqual({ status: 'invalid' })
  })

  it('recusa typ que não seja at+jwt', async () => {
    const token = await mint({ typ: 'JWT' })

    expect(await verifyMcpAccessToken(token)).toEqual({ status: 'invalid' })
  })

  it('recusa algoritmo fora da lista', async () => {
    const rsa = await generateKeyPair('RS256', { extractable: true })
    const token = await mint({ alg: 'RS256', key: rsa.privateKey })

    expect(await verifyMcpAccessToken(token)).toEqual({ status: 'invalid' })
  })

  it('recusa lixo e tokens sem sub', async () => {
    expect(await verifyMcpAccessToken('nao-e-um-jwt')).toEqual({ status: 'invalid' })

    const withoutSub = await new SignJWT({ scope: 'leaf:read', client_id: 'c' })
      .setProtectedHeader({ alg: 'EdDSA', kid, typ: 'at+jwt' })
      .setIssuer(authIssuer())
      .setAudience(mcpResourceUrl())
      .setExpirationTime('5m')
      .sign(signing.privateKey)

    expect(await verifyMcpAccessToken(withoutSub)).toEqual({ status: 'invalid' })
  })
})
