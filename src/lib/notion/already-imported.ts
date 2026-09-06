import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'

import { db } from '@/db'
import { documents, notionDocuments, teamspaces } from '@/db/schema'
import type { AlreadyImportedDocument } from '@/lib/notion/import'

export type NotionImportFootprint = Readonly<{
  documents: number
  latestAt: Date | null
}>

export type NotionWorkspaceImportState = Readonly<{
  byOthers: NotionImportFootprint | null
  byMe: NotionImportFootprint | null
}>

function normalize(id: string): string {
  return id.replace(/-/g, '').toLowerCase()
}

function organizationScope(orgId: string) {
  const orgTeamspaces = db
    .select({ id: teamspaces.id })
    .from(teamspaces)
    .where(eq(teamspaces.orgId, orgId))

  return and(
    isNull(documents.deletedAt),
    or(eq(documents.orgId, orgId), inArray(documents.teamspaceId, orgTeamspaces)),
  )
}

export async function listAlreadyImportedByOthers(
  userId: string,
  orgId: string | null,
): Promise<Map<string, AlreadyImportedDocument>> {
  const result = new Map<string, AlreadyImportedDocument>()

  if (!orgId) {
    return result
  }

  const rows = await db
    .select({
      documentId: notionDocuments.documentId,
      notionId: notionDocuments.notionId,
      title: documents.title,
    })
    .from(notionDocuments)
    .innerJoin(documents, eq(documents.id, notionDocuments.documentId))
    .where(and(ne(notionDocuments.userId, userId), organizationScope(orgId)))

  for (const row of rows) {
    result.set(normalize(row.notionId), {
      documentId: row.documentId,
      title: row.title,
    })
  }

  return result
}

export async function summarizeNotionImports(
  userId: string,
  orgId: string,
): Promise<NotionWorkspaceImportState> {
  const rows = await db
    .select({
      userId: notionDocuments.userId,
      documents: sql<number>`count(*)`,
      latestAt: sql<Date | null>`max(${notionDocuments.createdAt})`,
    })
    .from(notionDocuments)
    .innerJoin(documents, eq(documents.id, notionDocuments.documentId))
    .where(organizationScope(orgId))
    .groupBy(notionDocuments.userId)

  let byMe: NotionImportFootprint | null = null
  let othersDocuments = 0
  let othersLatest: Date | null = null

  for (const row of rows) {
    const footprint = {
      documents: Number(row.documents),
      latestAt: row.latestAt ? new Date(row.latestAt) : null,
    }

    if (row.userId === userId) {
      byMe = footprint

      continue
    }

    othersDocuments += footprint.documents

    if (
      footprint.latestAt &&
      (!othersLatest || footprint.latestAt > othersLatest)
    ) {
      othersLatest = footprint.latestAt
    }
  }

  return {
    byMe,
    byOthers:
      othersDocuments > 0
        ? { documents: othersDocuments, latestAt: othersLatest }
        : null,
  }
}
