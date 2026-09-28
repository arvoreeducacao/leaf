import type { TrailNode } from '@/lib/document-trail'
import type { DocumentSummary } from '@/lib/documents'

export const RECENT_DOCUMENTS_LIMIT = 15

export function promoteVisitedDocuments(
  documents: ReadonlyArray<DocumentSummary>,
  visited: ReadonlyArray<TrailNode>,
  limit: number = RECENT_DOCUMENTS_LIMIT,
): Array<DocumentSummary> {
  const known = new Map(documents.map((document) => [document.id, document]))
  const promotedIds = new Set(visited.map((node) => node.id))

  const promoted = visited.map((node): DocumentSummary => {
    const existing = known.get(node.id)

    if (existing) {
      return { ...existing, title: node.title, icon: node.icon }
    }

    return {
      id: node.id,
      title: node.title,
      icon: node.icon,
      kind: node.kind,
      parentId: null,
      updatedAt: new Date(0),
      deletedAt: null,
      owned: false,
      shared: false,
    }
  })

  return [
    ...promoted,
    ...documents.filter((document) => !promotedIds.has(document.id)),
  ].slice(0, limit)
}

export function rememberVisit(
  visited: ReadonlyArray<TrailNode>,
  node: TrailNode,
): Array<TrailNode> {
  return [node, ...visited.filter((entry) => entry.id !== node.id)]
}
