import { and, asc, eq, isNull, max } from 'drizzle-orm'

import { db } from '@/db'
import { documentFavorites, documents } from '@/db/schema'
import type { DocumentSummary } from '@/lib/documents'

export const favoriteLimit = 30

export async function listFavoriteDocuments(
  userId: string,
): Promise<Array<DocumentSummary>> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      deletedAt: documents.deletedAt,
      parentId: documents.parentId,
      kind: documents.kind,
      icon: documents.icon,
      ownerId: documents.ownerId,
      position: documentFavorites.position,
    })
    .from(documentFavorites)
    .innerJoin(documents, eq(documents.id, documentFavorites.documentId))
    .where(
      and(eq(documentFavorites.userId, userId), isNull(documents.deletedAt)),
    )
    .orderBy(asc(documentFavorites.position), asc(documentFavorites.createdAt))
    .limit(favoriteLimit)

  return rows.map(({ ownerId, position, ...row }) => ({
    ...row,
    shared: false,
    owned: ownerId === userId,
  }))
}

export async function listFavoriteIds(
  userId: string,
): Promise<ReadonlySet<string>> {
  const rows = await db
    .select({ documentId: documentFavorites.documentId })
    .from(documentFavorites)
    .where(eq(documentFavorites.userId, userId))

  return new Set(rows.map((row) => row.documentId))
}

export async function isFavorite(userId: string, documentId: string) {
  const [row] = await db
    .select({ id: documentFavorites.id })
    .from(documentFavorites)
    .where(
      and(
        eq(documentFavorites.userId, userId),
        eq(documentFavorites.documentId, documentId),
      ),
    )
    .limit(1)

  return row !== undefined
}

export async function countFavorites(userId: string) {
  const rows = await db
    .select({ id: documentFavorites.id })
    .from(documentFavorites)
    .where(eq(documentFavorites.userId, userId))

  return rows.length
}

export async function nextFavoritePosition(userId: string) {
  const [row] = await db
    .select({ highest: max(documentFavorites.position) })
    .from(documentFavorites)
    .where(eq(documentFavorites.userId, userId))

  return (row?.highest ?? 0) + 1
}
