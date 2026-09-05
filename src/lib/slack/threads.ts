import { and, eq } from 'drizzle-orm'

import { db } from '@/db'
import { slackThreads } from '@/db/schema'

export type SlackThreadLink = Readonly<{
  documentId: string
  viewId: string | null
  channelId: string
  messageTs: string
}>

export async function getThreadOfDocument(
  documentId: string,
): Promise<SlackThreadLink | null> {
  const row = await db.query.slackThreads.findFirst({
    where: eq(slackThreads.documentId, documentId),
  })

  if (!row) {
    return null
  }

  return {
    channelId: row.channelId,
    documentId: row.documentId,
    messageTs: row.messageTs,
    viewId: row.viewId,
  }
}

export async function getThreadOfMessage(
  channelId: string,
  messageTs: string,
): Promise<SlackThreadLink | null> {
  const row = await db.query.slackThreads.findFirst({
    where: and(
      eq(slackThreads.channelId, channelId),
      eq(slackThreads.messageTs, messageTs),
    ),
  })

  if (!row) {
    return null
  }

  return {
    channelId: row.channelId,
    documentId: row.documentId,
    messageTs: row.messageTs,
    viewId: row.viewId,
  }
}

export async function saveThread(link: SlackThreadLink): Promise<void> {
  await db
    .insert(slackThreads)
    .values({
      channelId: link.channelId,
      createdAt: new Date(),
      documentId: link.documentId,
      messageTs: link.messageTs,
      viewId: link.viewId,
    })
    .onDuplicateKeyUpdate({
      set: {
        channelId: link.channelId,
        messageTs: link.messageTs,
        viewId: link.viewId,
      },
    })
}
