import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { documents } from '@/db/schema'
import { recordDocumentVersion } from '@/lib/document-versions'
import { sanitizeBlocks } from '@/lib/markdown/sanitize'
import { indexDocument } from '@/lib/search-index'

function sanitizeContentJSON(contentJSON: string): string {
  try {
    return JSON.stringify(sanitizeBlocks(JSON.parse(contentJSON)))
  } catch {
    return contentJSON
  }
}

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

  const safeContent = sanitizeContentJSON(contentJSON)

  if (current.content === safeContent) {
    return false
  }

  await db
    .update(documents)
    .set({ content: safeContent, updatedAt: new Date() })
    .where(eq(documents.id, id))

  await recordDocumentVersion(id, authorId)
  await indexDocument(id)

  return true
}
