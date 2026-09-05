import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { databaseViews, formWebhooks } from '@/db/schema'

export async function getFormWebhook(viewId: string): Promise<string | null> {
  const row = await db.query.formWebhooks.findFirst({
    where: eq(formWebhooks.viewId, viewId),
  })

  return row?.url ?? null
}

export async function listFormWebhookViewIds(
  databaseId: string,
): Promise<Array<string>> {
  const rows = await db
    .select({ viewId: formWebhooks.viewId })
    .from(formWebhooks)
    .innerJoin(databaseViews, eq(databaseViews.id, formWebhooks.viewId))
    .where(eq(databaseViews.databaseId, databaseId))

  return rows.map((row) => row.viewId)
}

export async function saveFormWebhook(viewId: string, url: string) {
  const now = new Date()

  await db
    .insert(formWebhooks)
    .values({ viewId, url, createdAt: now, updatedAt: now })
    .onDuplicateKeyUpdate({ set: { url, updatedAt: now } })
}

export async function removeFormWebhook(viewId: string) {
  await db.delete(formWebhooks).where(eq(formWebhooks.viewId, viewId))
}
