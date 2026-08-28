import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/db'
import { documentShares, documents } from '@/db/schema'
import type { Document } from '@/db/schema'

export type AccessLevel = 'owner' | 'editor' | 'viewer'

export type SessionLike = {
  user: { id: string; email: string }
} | null

const levelRank: Record<AccessLevel, number> = {
  viewer: 1,
  editor: 2,
  owner: 3,
}

export function atLeast(level: AccessLevel, required: AccessLevel) {
  return levelRank[level] >= levelRank[required]
}

export function canEdit(level: AccessLevel | null) {
  return level !== null && atLeast(level, 'editor')
}

export async function getDocumentAccess(
  docId: string,
  session: SessionLike,
): Promise<AccessLevel | null> {
  const document = await db.query.documents.findFirst({
    where: and(eq(documents.id, docId), isNull(documents.deletedAt)),
  })

  if (!document) {
    return null
  }

  if (!session) {
    return null
  }

  if (document.ownerId === session.user.id) {
    return 'owner'
  }

  const share = await db.query.documentShares.findFirst({
    where: and(
      eq(documentShares.documentId, docId),
      eq(documentShares.granteeEmail, session.user.email.toLowerCase()),
    ),
  })

  if (!share) {
    return null
  }

  return share.role
}

export async function getTrashedDocumentAccess(
  docId: string,
  session: SessionLike,
): Promise<AccessLevel | null> {
  if (!session) {
    return null
  }

  const document = await db.query.documents.findFirst({
    where: eq(documents.id, docId),
  })

  if (!document || document.ownerId !== session.user.id) {
    return null
  }

  return 'owner'
}

export function canManageShares(level: AccessLevel | null) {
  return level === 'owner'
}

export async function getPublicDocument(token: string) {
  const document = await db.query.documents.findFirst({
    where: and(eq(documents.publicToken, token), isNull(documents.deletedAt)),
  })

  return document ?? null
}

const publicTokenPattern = /^[A-Za-z0-9_-]{21,64}$/

export function isPublicTokenShaped(token: string) {
  return publicTokenPattern.test(token)
}

const lookupWindowMs = 60_000
const lookupMaxAttempts = 30
const lookupMaxKeys = 5_000
const lookupHits = new Map<string, Array<number>>()

export type RateLimitDecision = Readonly<{
  allowed: boolean
  retryAfterSeconds: number
}>

function pruneLookupHits(now: number) {
  for (const [key, hits] of lookupHits) {
    const last = hits.at(-1)

    if (last === undefined || now - last >= lookupWindowMs) {
      lookupHits.delete(key)
    }
  }

  if (lookupHits.size >= lookupMaxKeys) {
    lookupHits.clear()
  }
}

export function registerPublicLookupAttempt(
  key: string,
  now: number = Date.now(),
): RateLimitDecision {
  const previous = lookupHits.get(key) ?? []
  const recent = previous.filter((hit) => now - hit < lookupWindowMs)

  if (recent.length >= lookupMaxAttempts) {
    lookupHits.set(key, recent)
    const oldest = recent[0] ?? now

    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((lookupWindowMs - (now - oldest)) / 1000),
      ),
    }
  }

  if (!lookupHits.has(key) && lookupHits.size >= lookupMaxKeys) {
    pruneLookupHits(now)
  }

  recent.push(now)
  lookupHits.set(key, recent)

  return { allowed: true, retryAfterSeconds: 0 }
}

export function resetPublicLookupLimiter() {
  lookupHits.clear()
}

export type PublicLookupResult =
  | { status: 'ok'; document: Document }
  | { status: 'not-found' }
  | { status: 'rate-limited'; retryAfterSeconds: number }

export async function lookupPublicDocument(
  token: string,
  requesterKey: string,
): Promise<PublicLookupResult> {
  const decision = registerPublicLookupAttempt(requesterKey)

  if (!decision.allowed) {
    return {
      status: 'rate-limited',
      retryAfterSeconds: decision.retryAfterSeconds,
    }
  }

  if (!isPublicTokenShaped(token)) {
    return { status: 'not-found' }
  }

  const document = await getPublicDocument(token)

  if (!document) {
    return { status: 'not-found' }
  }

  return { status: 'ok', document }
}
