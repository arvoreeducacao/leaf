import { and, desc, eq, isNull, not } from 'drizzle-orm'

import { db } from '@/db'
import { documentShares, documents } from '@/db/schema'
import type { Document } from '@/db/schema'

export type DocumentSummary = Pick<
  Document,
  'id' | 'title' | 'updatedAt' | 'deletedAt' | 'parentId'
> & {
  shared: boolean
}

export type DocumentNode = DocumentSummary & {
  depth: number
  children: Array<DocumentNode>
}

export type DocumentCrumb = Pick<Document, 'id' | 'title'>

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
    })
    .from(documents)
    .where(and(eq(documents.ownerId, userId), isNull(documents.deletedAt)))
    .orderBy(desc(documents.updatedAt))

  return rows.map((row) => ({ ...row, shared: false }))
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
    })
    .from(documentShares)
    .innerJoin(documents, eq(documents.id, documentShares.documentId))
    .where(
      and(
        eq(documentShares.granteeEmail, email.toLowerCase()),
        isNull(documents.deletedAt),
      ),
    )
    .orderBy(desc(documents.updatedAt))

  return rows.map((row) => ({ ...row, shared: true, parentId: null }))
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
    })
    .from(documents)
    .where(and(eq(documents.ownerId, userId), not(isNull(documents.deletedAt))))
    .orderBy(desc(documents.deletedAt))

  return rows.map((row) => ({ ...row, shared: false }))
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

    crumbs.unshift({ id: parent.id, title: parent.title })
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
