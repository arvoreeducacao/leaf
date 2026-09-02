import { and, desc, eq, isNull, ne, not, sql } from 'drizzle-orm'

import { db } from '@/db'
import { documentShares, documents } from '@/db/schema'
import type { Document } from '@/db/schema'

export type DocumentSummary = Pick<
  Document,
  'id' | 'title' | 'updatedAt' | 'deletedAt' | 'parentId' | 'kind' | 'icon'
> & {
  shared: boolean
  owned: boolean
}

export type DocumentNode = DocumentSummary & {
  depth: number
  children: Array<DocumentNode>
}

export type DocumentCrumb = Pick<Document, 'id' | 'title' | 'icon' | 'kind'>

export async function listOwnedDocuments(
  userId: string,
): Promise<Array<DocumentSummary>> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      deletedAt: documents.deletedAt,
      parentId: documents.parentId,
      kind: documents.kind,
      icon: documents.icon,
    })
    .from(documents)
    .where(
      and(
        eq(documents.ownerId, userId),
        isNull(documents.deletedAt),
        ne(documents.kind, 'row'),
      ),
    )
    .orderBy(desc(documents.updatedAt))

  return rows.map((row) => ({ ...row, shared: false, owned: true }))
}

export async function listPrivateDocuments(
  userId: string,
): Promise<Array<DocumentSummary>> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      deletedAt: documents.deletedAt,
      parentId: documents.parentId,
      kind: documents.kind,
      icon: documents.icon,
    })
    .from(documents)
    .where(
      and(
        eq(documents.ownerId, userId),
        isNull(documents.deletedAt),
        isNull(documents.orgAccess),
        isNull(documents.teamspaceId),
        ne(documents.kind, 'row'),
      ),
    )
    .orderBy(desc(documents.updatedAt))

  return rows.map((row) => ({ ...row, shared: false, owned: true }))
}

export async function listSharedDocuments(
  email: string,
): Promise<Array<DocumentSummary>> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      deletedAt: documents.deletedAt,
      kind: documents.kind,
      icon: documents.icon,
    })
    .from(documentShares)
    .innerJoin(documents, eq(documents.id, documentShares.documentId))
    .where(
      and(
        eq(documentShares.granteeEmail, email.toLowerCase()),
        isNull(documents.deletedAt),
        ne(documents.kind, 'row'),
      ),
    )
    .orderBy(desc(documents.updatedAt))

  return rows.map((row) => ({ ...row, shared: true, owned: false, parentId: null }))
}

export async function listTrashedDocuments(
  userId: string,
): Promise<Array<DocumentSummary>> {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      updatedAt: documents.updatedAt,
      deletedAt: documents.deletedAt,
      parentId: documents.parentId,
      kind: documents.kind,
      icon: documents.icon,
    })
    .from(documents)
    .where(
      and(
        eq(documents.ownerId, userId),
        not(isNull(documents.deletedAt)),
        sql`(${documents.kind} <> 'row' or not exists (
          select 1 from documents parent
          where parent.id = ${documents.parentId} and parent.deleted_at is not null
        ))`,
      ),
    )
    .orderBy(desc(documents.deletedAt))

  return rows.map((row) => ({ ...row, shared: false, owned: true }))
}

export function pickRecentDocuments(
  lists: ReadonlyArray<ReadonlyArray<DocumentSummary>>,
  limit: number,
): Array<DocumentSummary> {
  const newest = new Map<string, DocumentSummary>()

  for (const list of lists) {
    for (const summary of list) {
      const current = newest.get(summary.id)

      if (!current || current.updatedAt < summary.updatedAt) {
        newest.set(summary.id, summary)
      }
    }
  }

  return [...newest.values()]
    .sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())
    .slice(0, limit)
}

export function buildDocumentTree(
  summaries: Array<DocumentSummary>,
): Array<DocumentNode> {
  const nodes = new Map<string, DocumentNode>()

  for (const summary of summaries) {
    nodes.set(summary.id, { ...summary, depth: 0, children: [] })
  }

  const roots: Array<DocumentNode> = []

  for (const summary of summaries) {
    const node = nodes.get(summary.id)

    if (!node) {
      continue
    }

    const parent = summary.parentId ? nodes.get(summary.parentId) : undefined

    if (parent && parent.id !== node.id) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }

  function applyDepth(list: Array<DocumentNode>, depth: number) {
    for (const node of list) {
      node.depth = depth
      applyDepth(node.children, depth + 1)
    }
  }

  applyDepth(roots, 0)

  return roots
}

export type BrowsableDocument = Pick<
  DocumentSummary,
  'id' | 'title' | 'icon' | 'kind'
>

export function toBrowsable(document: DocumentSummary): BrowsableDocument {
  return {
    id: document.id,
    title: document.title,
    icon: document.icon,
    kind: document.kind,
  }
}

export const sidebarBranchLimit = 20

export type CappedTree = Readonly<{
  nodes: Array<DocumentNode>
  hidden: number
}>

export function capDocumentTree(
  roots: Array<DocumentNode>,
  limit: number = sidebarBranchLimit,
): CappedTree {
  if (roots.length <= limit) {
    return { nodes: roots, hidden: 0 }
  }

  return { nodes: roots.slice(0, limit), hidden: roots.length - limit }
}

export async function getDocument(docId: string) {
  const document = await db.query.documents.findFirst({
    where: eq(documents.id, docId),
  })

  return document ?? null
}

export async function listAncestors(
  docId: string,
): Promise<Array<DocumentCrumb>> {
  const crumbs: Array<DocumentCrumb> = []
  const seen = new Set<string>([docId])

  let current = await db.query.documents.findFirst({
    where: eq(documents.id, docId),
  })

  while (current?.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId)

    const parent = await db.query.documents.findFirst({
      where: and(
        eq(documents.id, current.parentId),
        isNull(documents.deletedAt),
      ),
    })

    if (!parent) {
      break
    }

    crumbs.unshift({
      id: parent.id,
      title: parent.title,
      icon: parent.icon,
      kind: parent.kind,
    })
    current = parent
  }

  return crumbs
}

export async function listSubtreeIds(
  docId: string,
  ownerId: string,
): Promise<Array<string>> {
  const rows = await db
    .select({ id: documents.id, parentId: documents.parentId })
    .from(documents)
    .where(eq(documents.ownerId, ownerId))

  const childrenByParent = new Map<string, Array<string>>()

  for (const row of rows) {
    if (!row.parentId) {
      continue
    }

    const siblings = childrenByParent.get(row.parentId) ?? []
    siblings.push(row.id)
    childrenByParent.set(row.parentId, siblings)
  }

  const collected: Array<string> = []
  const queue = [docId]
  const seen = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift() as string

    if (seen.has(current)) {
      continue
    }

    seen.add(current)
    collected.push(current)
    queue.push(...(childrenByParent.get(current) ?? []))
  }

  return collected
}
