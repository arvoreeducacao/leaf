import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { documents } from '@/db/schema'
import { recordDocumentVersion } from '@/lib/document-versions'
import { indexDocument } from '@/lib/search-index'

export async function persistDocumentContent(
  id: string,
  contentJSON: string,
  authorId: string | null,
) {
  const current = await db.query.documents.findFirst({
    where: eq(documents.id, id),
  })

  if (!current || current.deletedAt !== null) {
    return false
  }

  if (current.content === contentJSON) {
    return false
  }

  await db
    .update(documents)
    .set({ content: contentJSON, updatedAt: new Date() })
    .where(eq(documents.id, id))

  await recordDocumentVersion(id, authorId)
  indexDocument(id)

  return true
}
