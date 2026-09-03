import {
  type JSONWebKeySet,
  type JWK,
  createLocalJWKSet,
  errors,
  jwtVerify,
} from 'jose'

import { db } from '@/db'
import { jwks } from '@/db/schema'
import { authIssuer, mcpResourceUrl } from '@/lib/mcp-config'

export const mcpTokenAlgorithms = ['EdDSA'] as const

export const mcpAccessTokenType = 'at+jwt'

export type VerifiedAccessToken = Readonly<{
  token: string
  userId: string
  clientId: string
  scopes: ReadonlyArray<string>
  expiresAt: number
}>

export type TokenVerification =
  | Readonly<{ status: 'ok'; access: VerifiedAccessToken }>
  | Readonly<{ status: 'invalid' }>

type KeyCache = Readonly<{
  resolve: ReturnType<typeof createLocalJWKSet>
  kids: ReadonlySet<string>
  loadedAt: number
}>

const cacheTtlMs = 5 * 60_000

let keyCache: KeyCache | null = null

async function loadKeys(now: number): Promise<KeyCache> {
  const rows = await db
    .select({ id: jwks.id, publicKey: jwks.publicKey, alg: jwks.alg })
    .from(jwks)

  const keys: Array<JWK> = []

  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.publicKey) as JWK

      keys.push({ ...parsed, kid: row.id, alg: row.alg ?? parsed.alg })
    } catch {
      continue
    }
  }

  const keySet: JSONWebKeySet = { keys }

  return {
    resolve: createLocalJWKSet(keySet),
    kids: new Set(keys.map((key) => key.kid ?? '')),
    loadedAt: now,
  }
}

async function keysFor(kid: string | undefined, now: number) {
  if (
    !keyCache ||
    now - keyCache.loadedAt > cacheTtlMs ||
    (kid !== undefined && !keyCache.kids.has(kid))
  ) {
    keyCache = await loadKeys(now)
  }

  return keyCache
}

export function resetMcpKeyCache() {
  keyCache = null
}

function scopesOf(value: unknown): Array<string> {
  if (typeof value !== 'string') {
    return []
  }

  return value.split(' ').filter((scope) => scope.length > 0)
}

export async function verifyMcpAccessToken(
  token: string,
  now: Date = new Date(),
): Promise<TokenVerification> {
  try {
    const { payload } = await jwtVerify(
      token,
      async (header, jwt) => {
        const cache = await keysFor(header.kid, now.getTime())

        return cache.resolve(header, jwt)
      },
      {
        algorithms: [...mcpTokenAlgorithms],
        audience: mcpResourceUrl(),
        currentDate: now,
        issuer: authIssuer(),
        typ: mcpAccessTokenType,
      },
    )

    if (
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      typeof payload.client_id !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return { status: 'invalid' }
    }

    return {
      status: 'ok',
      access: {
        token,
        userId: payload.sub,
        clientId: payload.client_id,
        scopes: scopesOf(payload.scope),
        expiresAt: payload.exp,
      },
    }
  } catch (error) {
    if (
      error instanceof errors.JOSEError ||
      error instanceof SyntaxError ||
      error instanceof TypeError
    ) {
      return { status: 'invalid' }
    }

    throw error
  }
}
