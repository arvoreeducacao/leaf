import { and, desc, eq, isNull } from 'drizzle-orm'

import { db } from '@/db'
import {
  oauthAccessTokens,
  oauthClients,
  oauthConsents,
  oauthRefreshTokens,
} from '@/db/schema'

export type ConnectedApp = Readonly<{
  consentId: string
  clientId: string
  name: string | null
  uri: string | null
  scopes: ReadonlyArray<string>
  grantedAt: string | null
  updatedAt: string | null
}>

function parseScopes(raw: string | null): Array<string> {
  if (!raw) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return raw.split(' ').filter((scope) => scope.length > 0)
  }
}

export async function listConnectedApps(
  userId: string,
): Promise<Array<ConnectedApp>> {
  const rows = await db
    .select({
      consentId: oauthConsents.id,
      clientId: oauthConsents.clientId,
      scopes: oauthConsents.scopes,
      grantedAt: oauthConsents.createdAt,
      updatedAt: oauthConsents.updatedAt,
      name: oauthClients.name,
      uri: oauthClients.uri,
    })
    .from(oauthConsents)
    .innerJoin(oauthClients, eq(oauthClients.clientId, oauthConsents.clientId))
    .where(eq(oauthConsents.userId, userId))
    .orderBy(desc(oauthConsents.updatedAt))

  return rows.map((row) => ({
    consentId: row.consentId,
    clientId: row.clientId,
    name: row.name,
    uri: row.uri,
    scopes: parseScopes(row.scopes),
    grantedAt: row.grantedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  }))
}

export async function getConsentClient(clientId: string) {
  const client = await db.query.oauthClients.findFirst({
    where: eq(oauthClients.clientId, clientId),
  })

  if (!client || client.disabled) {
    return null
  }

  return { clientId: client.clientId, name: client.name, uri: client.uri }
}

export async function revokeConnectedApp(
  userId: string,
  consentId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const consent = await db.query.oauthConsents.findFirst({
    where: and(eq(oauthConsents.id, consentId), eq(oauthConsents.userId, userId)),
  })

  if (!consent) {
    return false
  }

  await db.delete(oauthConsents).where(eq(oauthConsents.id, consent.id))

  await db
    .update(oauthRefreshTokens)
    .set({ revoked: now })
    .where(
      and(
        eq(oauthRefreshTokens.clientId, consent.clientId),
        eq(oauthRefreshTokens.userId, userId),
        isNull(oauthRefreshTokens.revoked),
      ),
    )

  await db
    .update(oauthAccessTokens)
    .set({ revoked: now })
    .where(
      and(
        eq(oauthAccessTokens.clientId, consent.clientId),
        eq(oauthAccessTokens.userId, userId),
        isNull(oauthAccessTokens.revoked),
      ),
    )

  return true
}
