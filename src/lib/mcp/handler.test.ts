import { SignJWT, exportJWK, generateKeyPair } from 'jose'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { db } from '@/db'
import { documents, jwks, user } from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { authIssuer, mcpResourceUrl } from '@/lib/mcp-config'
import { handleMcpRequest, resetMcpLimiter } from '@/lib/mcp/handler'
import { resetMcpKeyCache } from '@/lib/mcp/token'

const kid = 'jwk-handler'
const person = { id: 'handler-user', email: 'pessoa@arvore.com.br' }

let privateKey: CryptoKey

beforeAll(async () => {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519', extractable: true })

  privateKey = pair.privateKey

  await resetDatabase()
  await db.insert(jwks).values({
    id: kid,
    publicKey: JSON.stringify(await exportJWK(pair.publicKey)),
    privateKey: 'nao-usado',
    alg: 'EdDSA',
    crv: 'Ed25519',
    createdAt: new Date(),
  })
  await db.insert(user).values({
    id: person.id,
    name: 'Pessoa',
    email: person.email,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  await db.insert(documents).values({
    id: 'doc-handler',
    ownerId: person.id,
    title: 'Documento da pessoa',
    content: JSON.stringify([
      { id: 'b1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Leitura crítica.', styles: {} }], children: [] },
    ]),
    createdAt: new Date(),
    updatedAt: new Date(),
  })
})

beforeEach(() => {
  resetMcpLimiter()
  resetMcpKeyCache()
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('LEAF_MCP_ENABLED', '1')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

async function token(sub = person.id, scope = 'leaf:read leaf:write offline_access') {
  return new SignJWT({ scope, client_id: 'client-handler' })
    .setProtectedHeader({ alg: 'EdDSA', kid, typ: 'at+jwt' })
    .setIssuer(authIssuer())
    .setAudience(mcpResourceUrl())
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(privateKey)
}

function rpc(method: string, params: unknown, id = 1) {
  return JSON.stringify({ jsonrpc: '2.0', id, method, params })
}

function post(body: string, bearer: string | null, extra: Record<string, string> = {}) {
  const url = new URL(mcpResourceUrl())

  return new Request(url, {
    method: 'POST',
    headers: {
      host: url.host,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(bearer ? { authorization: `Bearer ${bearer}` } : {}),
      ...extra,
    },
    body,
  })
}

const initialize = rpc('initialize', {
  protocolVersion: '2025-06-18',
  capabilities: {},
  clientInfo: { name: 'teste', version: '0' },
})

describe('endpoint MCP', () => {
  it('answers 404 with the flag turned off', async () => {
    vi.stubEnv('LEAF_MCP_ENABLED', 'false')

    const response = await handleMcpRequest(post(initialize, await token()))

    expect(response.status).toBe(404)
  })

  it('answers 401 with WWW-Authenticate pointing at the resource metadata when there is no bearer', async () => {
    const response = await handleMcpRequest(post(initialize, null))

    expect(response.status).toBe(401)
    expect(response.headers.get('www-authenticate')).toBe(
      `Bearer error="invalid_token", resource_metadata="${authIssuer()}/.well-known/oauth-protected-resource/api/mcp"`,
    )
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('answers 401 for an invalid token and for a user who no longer exists', async () => {
    expect((await handleMcpRequest(post(initialize, 'token-falso'))).status).toBe(401)
    expect((await handleMcpRequest(post(initialize, await token('user-removido')))).status).toBe(401)
  })

  it('accepts POST only', async () => {
    const url = new URL(mcpResourceUrl())
    const response = await handleMcpRequest(
      new Request(url, { method: 'GET', headers: { host: url.host, authorization: `Bearer ${await token()}` } }),
    )

    expect(response.status).toBe(405)
  })

  it('initializes and runs a tool as the user behind the token', async () => {
    const bearer = await token()
    const initialized = await handleMcpRequest(post(initialize, bearer))

    expect(initialized.status).toBe(200)
    expect(initialized.headers.get('cache-control')).toBe('no-store')

    const called = await handleMcpRequest(
      post(rpc('tools/call', { name: 'get_document', arguments: { documentId: 'doc-handler' } }, 2), bearer),
    )
    const payload = (await called.json()) as { result: { content: Array<{ text: string }> } }

    expect(called.status).toBe(200)
    expect(payload.result.content[0].text).toContain('Leitura crítica.')
  })

  it('recusa host desconhecido (DNS rebinding)', async () => {
    const response = await handleMcpRequest(post(initialize, await token(), { host: 'atacante.exemplo' }))

    expect(response.status).toBe(403)
  })

  it('refuses a body over 1 MB and invalid JSON', async () => {
    const huge = `{"jsonrpc":"2.0","id":1,"method":"ping","params":{"x":"${'a'.repeat(1_000_001)}"}}`

    expect((await handleMcpRequest(post(huge, await token()))).status).toBe(413)
    expect((await handleMcpRequest(post('{nao-json', await token()))).status).toBe(400)
  })

  it('rate limits per user', async () => {
    const bearer = await token()
    let last = 200

    for (let attempt = 0; attempt < 61; attempt += 1) {
      last = (await handleMcpRequest(post(rpc('ping', {}, attempt + 10), bearer))).status
    }

    expect(last).toBe(429)
  })
})
