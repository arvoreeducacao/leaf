import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { databaseViews, formWebhooks } from '@/db/schema'

export type FormSlackLink = Readonly<{
  viewId: string
  url: string | null
  channelId: string | null
  channelName: string | null
  pullThread: boolean
  pushComments: boolean
}>

function toLink(row: {
  viewId: string
  url: string | null
  channelId: string | null
  channelName: string | null
  pullThread: boolean
  pushComments: boolean
}): FormSlackLink {
  return {
    channelId: row.channelId,
    channelName: row.channelName,
    pullThread: row.pullThread,
    pushComments: row.pushComments,
    url: row.url,
    viewId: row.viewId,
  }
}

export async function getFormSlack(
  viewId: string,
): Promise<FormSlackLink | null> {
  const row = await db.query.formWebhooks.findFirst({
    where: eq(formWebhooks.viewId, viewId),
  })

  return row ? toLink(row) : null
}

export async function listFormSlackLinks(
  databaseId: string,
): Promise<Array<FormSlackLink>> {
  const rows = await db
    .select({
      channelId: formWebhooks.channelId,
      channelName: formWebhooks.channelName,
      pullThread: formWebhooks.pullThread,
      pushComments: formWebhooks.pushComments,
      url: formWebhooks.url,
      viewId: formWebhooks.viewId,
    })
    .from(formWebhooks)
    .innerJoin(databaseViews, eq(databaseViews.id, formWebhooks.viewId))
    .where(eq(databaseViews.databaseId, databaseId))

  return rows.map(toLink)
}

export async function saveFormWebhookUrl(viewId: string, url: string) {
  const now = new Date()

  await db
    .insert(formWebhooks)
    .values({ createdAt: now, updatedAt: now, url, viewId })
    .onDuplicateKeyUpdate({ set: { url, updatedAt: now } })
}

export async function saveFormChannel(
  viewId: string,
  channelId: string,
  channelName: string,
) {
  const now = new Date()

  await db
    .insert(formWebhooks)
    .values({ channelId, channelName, createdAt: now, updatedAt: now, viewId })
    .onDuplicateKeyUpdate({
      set: { channelId, channelName, updatedAt: now },
    })
}

export async function setFormThreadSync(
  viewId: string,
  pullThread: boolean,
  pushComments: boolean,
) {
  const now = new Date()

  await db
    .update(formWebhooks)
    .set({ pullThread, pushComments, updatedAt: now })
    .where(eq(formWebhooks.viewId, viewId))
}

export async function removeFormWebhook(viewId: string) {
  await db.delete(formWebhooks).where(eq(formWebhooks.viewId, viewId))
}
