import { sql } from 'drizzle-orm'

import { db } from '@/db'
import type { Document } from '@/db/schema'
import { documentVisits } from '@/db/schema'
import type { DocumentSummary } from '@/lib/documents'
import { type ViewerKeys, accessCondition } from '@/lib/search-index'

type VisitedRow = Readonly<{
  id: string
  title: string
  icon: string | null
  kind: Document['kind']
  parentId: string | null
  ownerId: string
  updatedAt: Date | string
}>

export async function recordDocumentVisit(
  userId: string,
  documentId: string,
  visitedAt: Date = new Date(),
) {
  await db
    .insert(documentVisits)
    .values({ userId, documentId, visitedAt })
    .onDuplicateKeyUpdate({ set: { visitedAt } })
}

export async function listVisitedDocuments(
  viewer: ViewerKeys,
  limit: number,
): Promise<Array<DocumentSummary>> {
  const result = (await db.execute(sql`
    select
      d.id as id,
      d.title as title,
      d.icon as icon,
      d.kind as kind,
      d.parent_id as parentId,
      d.owner_id as ownerId,
      d.updated_at as updatedAt
    from document_visits v
    join documents d on d.id = v.document_id
    where v.user_id = ${viewer.userId}
      and d.deleted_at is null
      and d.kind <> 'template'
      and ${accessCondition(viewer)}
    order by v.visited_at desc
    limit ${limit}
  `)) as unknown as [Array<VisitedRow>, unknown]

  return result[0].map(({ ownerId, updatedAt, ...row }) => ({
    ...row,
    updatedAt: new Date(updatedAt),
    deletedAt: null,
    owned: ownerId === viewer.userId,
    shared: ownerId !== viewer.userId,
  }))
}
