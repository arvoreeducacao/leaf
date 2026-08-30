import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/db'
import {
  documentShares,
  documents,
  organizationMembers,
} from '@/db/schema'
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

  if (share) {
    return share.role
  }

  if (!document.orgId || !document.orgAccess) {
    return null
  }

  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.orgId, document.orgId),
      eq(organizationMembers.userId, session.user.id),
    ),
  })

  if (!membership) {
    return null
  }

  return document.orgAccess
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

const maxLimiterKeys = 5_000

export type RateLimitDecision = Readonly<{
  allowed: boolean
  retryAfterSeconds: number
}>

function createRateLimiter(windowMs: number, maxAttempts: number) {
  const hits = new Map<string, Array<number>>()

  function prune(now: number) {
    for (const [key, entries] of hits) {
      const last = entries.at(-1)

      if (last === undefined || now - last >= windowMs) {
        hits.delete(key)
      }
    }

    if (hits.size >= maxLimiterKeys) {
      hits.clear()
    }
  }

  function register(key: string, now: number = Date.now()): RateLimitDecision {
    const previous = hits.get(key) ?? []
    const recent = previous.filter((hit) => now - hit < windowMs)

    if (recent.length >= maxAttempts) {
      hits.set(key, recent)
      const oldest = recent[0] ?? now

      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((windowMs - (now - oldest)) / 1000),
        ),
      }
    }

    if (!hits.has(key) && hits.size >= maxLimiterKeys) {
      prune(now)
    }

    recent.push(now)
    hits.set(key, recent)

    return { allowed: true, retryAfterSeconds: 0 }
  }

  return { register, reset: () => hits.clear() }
}

const publicLookupLimiter = createRateLimiter(60_000, 30)
const inviteLimiter = createRateLimiter(60_000, 20)

export function registerPublicLookupAttempt(
  key: string,
  now: number = Date.now(),
): RateLimitDecision {
  return publicLookupLimiter.register(key, now)
}

export function resetPublicLookupLimiter() {
  publicLookupLimiter.reset()
}

export function registerInviteAttempt(
  key: string,
  now: number = Date.now(),
): RateLimitDecision {
  return inviteLimiter.register(key, now)
}

export function resetInviteLimiter() {
  inviteLimiter.reset()
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
