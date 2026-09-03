import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { sidebarPreferences } from '@/db/schema'
import type { SidebarLayout } from '@/lib/sidebar-layout'
import { parseSidebarLayout, serializeSidebarLayout } from '@/lib/sidebar-layout'

export async function readSidebarLayout(userId: string) {
  const [row] = await db
    .select({ sections: sidebarPreferences.sections })
    .from(sidebarPreferences)
    .where(eq(sidebarPreferences.userId, userId))
    .limit(1)

  return parseSidebarLayout(row?.sections)
}

export async function writeSidebarLayout(
  userId: string,
  layout: SidebarLayout,
) {
  const sections = serializeSidebarLayout(layout)
  const updatedAt = new Date()

  await db
    .insert(sidebarPreferences)
    .values({ sections, updatedAt, userId })
    .onDuplicateKeyUpdate({ set: { sections, updatedAt } })
}
