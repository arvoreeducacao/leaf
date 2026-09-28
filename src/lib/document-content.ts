import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { documents } from '@/db/schema'
import { recordDocumentVersion } from '@/lib/document-versions'
import { sanitizeBlocks } from '@/lib/markdown/sanitize'
import { notifyAddedMentions, sendMentionDms } from '@/lib/notifications'
import { indexDocument } from '@/lib/search-index'

export type PersistOutcome = 'written' | 'unchanged' | 'missing' | 'conflict'

function sanitizeContentJSON(contentJSON: string): string {
  try {
    return JSON.stringify(sanitizeBlocks(JSON.parse(contentJSON)))
  } catch {
    return contentJSON
  }
}

async function notifyMentions(
  id: string,
  authorId: string | null,
  previousContent: string | null,
  nextContent: string,
) {
  try {
    const recipients = await notifyAddedMentions({
      actorId: authorId,
      documentId: id,
      nextContent,
      previousContent,
    })

    void sendMentionDms({
      actorId: authorId,
      documentId: id,
      recipients,
    }).catch(() => undefined)
  } catch {
    return
  }
}

async function finishPersist(
  id: string,
  authorId: string | null,
  previousContent: string | null,
  nextContent: string,
) {
  await recordDocumentVersion(id, authorId)
  await indexDocument(id)
  await notifyMentions(id, authorId, previousContent, nextContent)
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

  await finishPersist(id, authorId, current.content, safeContent)

  return true
}

export async function persistDocumentContentIfUnchanged(
  id: string,
  contentJSON: string,
  authorId: string | null,
  expectedUpdatedAt: Date,
): Promise<PersistOutcome> {
  const current = await db.query.documents.findFirst({
    where: eq(documents.id, id),
  })

  if (!current || current.deletedAt !== null) {
    return 'missing'
  }

  if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return 'conflict'
  }

  const safeContent = sanitizeContentJSON(contentJSON)

  if (current.content === safeContent) {
    return 'unchanged'
  }

  const result = await db
    .update(documents)
    .set({ content: safeContent, updatedAt: new Date() })
    .where(
      and(eq(documents.id, id), eq(documents.updatedAt, expectedUpdatedAt)),
    )

  const affected = (result as unknown as [{ affectedRows?: number }])[0]
    ?.affectedRows

  if (affected === 0) {
    return 'conflict'
  }

  await finishPersist(id, authorId, current.content, safeContent)

  return 'written'
}
