import { and, desc, eq, isNull, not } from 'drizzle-orm'

import { db } from '@/db'
import { documentShares, documents } from '@/db/schema'
import type { Document } from '@/db/schema'

export type DocumentSummary = Pick<
  Document,
  'id' | 'title' | 'updatedAt' | 'deletedAt'
> & {
  shared: boolean
}

export async function listOwnedDocuments(
  userId: string,
): Promise<Array<DocumentSummary>> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      deletedAt: documents.deletedAt,
    })
    .from(documents)
    .where(and(eq(documents.ownerId, userId), isNull(documents.deletedAt)))
    .orderBy(desc(documents.updatedAt))

  return rows.map((row) => ({ ...row, shared: false }))
}

export async function listSharedDocuments(
  email: string,
): Promise<Array<DocumentSummary>> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      deletedAt: documents.deletedAt,
    })
    .from(documentShares)
    .innerJoin(documents, eq(documents.id, documentShares.documentId))
    .where(
      and(
        eq(documentShares.granteeEmail, email.toLowerCase()),
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(desc(documents.updatedAt))

  return rows.map((row) => ({ ...row, shared: true }))
}

export async function listTrashedDocuments(
  userId: string,
): Promise<Array<DocumentSummary>> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      deletedAt: documents.deletedAt,
    })
    .from(documents)
    .where(and(eq(documents.ownerId, userId), not(isNull(documents.deletedAt))))
    .orderBy(desc(documents.deletedAt))

  return rows.map((row) => ({ ...row, shared: false }))
}

export async function getDocument(docId: string) {
  const document = await db.query.documents.findFirst({
    where: eq(documents.id, docId),
  })

  return document ?? null
}
