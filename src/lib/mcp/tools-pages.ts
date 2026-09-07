import { and, eq, inArray, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import { documents } from '@/db/schema'
import type { Document } from '@/db/schema'
import { getDocumentAccess, getTrashedDocumentAccess } from '@/lib/authz'
import { copyDatabaseInto } from '@/lib/databases'
import { getDocument, listSubtreeIds } from '@/lib/documents'
import { ORGANIZATION_IMPORT_ACCESS } from '@/lib/import-destination'
import {
  type McpToolContext,
  McpToolError,
  documentUrl,
  requireDocumentId,
  requireWrite,
} from '@/lib/mcp/tools'
import { invalid } from '@/lib/mcp/row-values'
import { getMembership } from '@/lib/organizations'
import { canPlaceDocuments, getTeamspace } from '@/lib/teamspaces'

async function searchIndex() {
  return import('@/lib/search-index')
}

async function requireOwned(
  documentId: string,
  context: McpToolContext,
): Promise<Document> {
  const id = requireDocumentId(documentId)
  const access = await getDocumentAccess(id, context.session)

  if (!access) {
    throw new McpToolError('not_found', 'document not found')
  }

  if (access !== 'owner') {
    throw new McpToolError('forbidden', 'only the owner can do this')
  }

  const document = await getDocument(id)

  if (!document || document.deletedAt) {
    throw new McpToolError('not_found', 'document not found')
  }

  return document
}

function placement(document: Document) {
  return {
    parentId: document.parentId,
    teamspaceId: document.teamspaceId,
    orgId: document.orgId,
    inOrganization: document.orgAccess !== null,
  }
}

export async function moveDocumentTool(
  context: McpToolContext,
  args: Readonly<{
    documentId: string
    parentId?: string
    teamspaceId?: string
    destination?: 'private' | 'organization'
  }>,
) {
  requireWrite(context)

  const targets = [args.parentId, args.teamspaceId, args.destination].filter(
    (value) => value !== undefined,
  )

  if (targets.length !== 1) {
    invalid('send exactly one of parentId, teamspaceId or destination')
  }

  const document = await requireOwned(args.documentId, context)
  const userId = context.session.user.id
  const subtree = await listSubtreeIds(document.id, userId)
  const now = new Date()

  if (args.parentId !== undefined) {
    const parentId = requireDocumentId(args.parentId)

    if (parentId === document.id) {
      invalid('a document cannot be its own parent')
    }

    if (subtree.includes(parentId)) {
      invalid('the target is inside the document being moved')
    }

    const parent = await requireOwned(parentId, context)

    if (parent.kind !== 'page') {
      invalid('the target must be a page')
    }

    await db
      .update(documents)
      .set({ parentId: parent.id, updatedAt: now })
      .where(eq(documents.id, document.id))
    await db
      .update(documents)
      .set({
        teamspaceId: parent.teamspaceId,
        orgId: parent.orgId,
        orgAccess: parent.orgAccess,
      })
      .where(inArray(documents.id, subtree))
  } else if (args.teamspaceId !== undefined) {
    const membership = await getMembership(userId)
    const allowed = await canPlaceDocuments(
      args.teamspaceId,
      userId,
      membership?.orgId ?? null,
    )
    const teamspace = allowed ? await getTeamspace(args.teamspaceId) : null

    if (!teamspace) {
      throw new McpToolError('forbidden', 'cannot place documents in this teamspace')
    }

    await db
      .update(documents)
      .set({ parentId: null, updatedAt: now })
      .where(eq(documents.id, document.id))
    await db
      .update(documents)
      .set({ teamspaceId: teamspace.id, orgId: teamspace.orgId, orgAccess: null })
      .where(inArray(documents.id, subtree))
  } else if (args.destination === 'organization') {
    const membership = await getMembership(userId)

    if (!membership) {
      throw new McpToolError('forbidden', 'you are not in an organization')
    }

    await db
      .update(documents)
      .set({ parentId: null, updatedAt: now })
      .where(eq(documents.id, document.id))
    await db
      .update(documents)
      .set({
        teamspaceId: null,
        orgId: membership.orgId,
        orgAccess: ORGANIZATION_IMPORT_ACCESS,
      })
      .where(inArray(documents.id, subtree))
  } else {
    await db
      .update(documents)
      .set({ parentId: null, updatedAt: now })
      .where(eq(documents.id, document.id))
    await db
      .update(documents)
      .set({ teamspaceId: null, orgAccess: null })
      .where(inArray(documents.id, subtree))
  }

  context.onDocumentWritten?.(document.id)

  const moved = await getDocument(document.id)

  return {
    id: document.id,
    url: documentUrl(document.id),
    movedDocuments: subtree.length,
    ...(moved ? placement(moved) : {}),
  }
}

function copyTitle(context: McpToolContext, title: string) {
  const portuguese = (context.locale ?? 'pt-BR').toLowerCase().startsWith('pt')

  return (portuguese ? `Cópia de ${title}` : `Copy of ${title}`).slice(0, 200)
}

export async function duplicateDocumentTool(
  context: McpToolContext,
  args: Readonly<{ documentId: string }>,
) {
  requireWrite(context)

  const source = await requireOwned(args.documentId, context)

  if (source.kind === 'row') {
    invalid('duplicate the row through its database instead')
  }

  const userId = context.session.user.id
  const id = nanoid(12)
  const now = new Date()
  const title = copyTitle(context, source.title)

  await db.insert(documents).values({
    id,
    ownerId: userId,
    parentId: source.parentId,
    orgId: source.orgId,
    teamspaceId: source.teamspaceId,
    orgAccess: source.orgAccess,
    kind: source.kind,
    title,
    icon: source.icon,
    cover: source.cover,
    content: source.content,
    properties: source.properties,
    createdAt: now,
    updatedAt: now,
  })

  const { indexDocument } = await searchIndex()
  let rows = 0

  if (source.kind === 'database') {
    const rowIds = await copyDatabaseInto(source.id, id, userId, now)

    rows = rowIds.length

    for (const rowId of rowIds) {
      await indexDocument(rowId)
    }
  }

  await indexDocument(id)
  context.onDocumentWritten?.(id)

  return { id, title, kind: source.kind, parentId: source.parentId, rows, url: documentUrl(id) }
}

export async function trashDocumentTool(
  context: McpToolContext,
  args: Readonly<{ documentId: string }>,
) {
  requireWrite(context)

  const document = await requireOwned(args.documentId, context)
  const subtree = await listSubtreeIds(document.id, context.session.user.id)

  await db
    .update(documents)
    .set({ deletedAt: new Date() })
    .where(and(inArray(documents.id, subtree), isNull(documents.deletedAt)))

  const { removeDocumentFromIndex } = await searchIndex()

  for (const id of subtree) {
    await removeDocumentFromIndex(id)
  }

  context.onDocumentWritten?.(document.id)

  return { id: document.id, trashed: true, trashedDocuments: subtree.length }
}

export async function restoreDocumentTool(
  context: McpToolContext,
  args: Readonly<{ documentId: string }>,
) {
  requireWrite(context)

  const id = requireDocumentId(args.documentId)
  const access = await getTrashedDocumentAccess(id, context.session)

  if (access !== 'owner') {
    throw new McpToolError('not_found', 'document not found in the trash')
  }

  const document = await getDocument(id)

  if (!document || !document.deletedAt) {
    throw new McpToolError('not_found', 'document not found in the trash')
  }

  const subtree = await listSubtreeIds(id, context.session.user.id)
  const now = new Date()
  let parentId = document.parentId

  if (parentId) {
    const parent = await getDocument(parentId)

    if (!parent || parent.deletedAt) {
      parentId = null

      await db.update(documents).set({ parentId: null }).where(eq(documents.id, id))
    }
  }

  await db
    .update(documents)
    .set({ deletedAt: null, updatedAt: now })
    .where(inArray(documents.id, subtree))

  const { indexDocument } = await searchIndex()

  for (const restored of subtree) {
    await indexDocument(restored)
  }

  context.onDocumentWritten?.(id)

  return {
    id,
    restored: true,
    restoredDocuments: subtree.length,
    parentId,
    url: documentUrl(id),
  }
}
