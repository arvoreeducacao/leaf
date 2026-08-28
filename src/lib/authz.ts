import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/db'
import { documentShares, documents } from '@/db/schema'

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

export async function getPublicDocument(token: string) {
  const document = await db.query.documents.findFirst({
    where: and(eq(documents.publicToken, token), isNull(documents.deletedAt)),
  })

  return document ?? null
}
