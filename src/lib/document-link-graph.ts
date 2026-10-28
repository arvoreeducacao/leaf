import { type SQL, and, eq, inArray, isNull, or, sql } from 'drizzle-orm'

import { db } from '@/db'
import { type Document, documentLinks, documents, teamspaces } from '@/db/schema'
import { type SessionLike, getDocumentAccess } from '@/lib/authz'
import { type ViewerKeys, accessCondition } from '@/lib/search-index'

export const MAX_DOCUMENT_LINKS = 400
export const MAX_GRAPH_NODES = 6000

export type LinkRelation = 'citation' | 'subpage' | 'parent'

export type LinkedDocument = Readonly<{
  id: string
  title: string
  icon: string | null
  kind: Document['kind']
  relation: LinkRelation
  context: string
}>

export type DocumentLinks = Readonly<{
  incoming: Array<LinkedDocument>
  outgoing: Array<LinkedDocument>
}>

export type GraphNode = Readonly<{
  id: string
  title: string
  icon: string | null
  kind: Document['kind']
  parentId: string | null
  teamspaceId: string | null
}>

export type GraphEdge = Readonly<{
  source: string
  target: string
  relation: LinkRelation
}>

export type OrganizationGraph = Readonly<{
  nodes: Array<GraphNode>
  edges: Array<GraphEdge>
  teamspaces: Array<Readonly<{ id: string; name: string }>>
}>

type Endpoint = Readonly<{ id: string; parentId: string | null }>

const relationRank: Record<LinkRelation, number> = {
  citation: 0,
  parent: 1,
  subpage: 2,
}

export function relationOf(source: Endpoint, target: Endpoint): LinkRelation {
  if (target.parentId === source.id) {
    return 'subpage'
  }

  if (source.parentId === target.id) {
    return 'parent'
  }

  return 'citation'
}

function byRelationThenTitle(a: LinkedDocument, b: LinkedDocument) {
  return (
    relationRank[a.relation] - relationRank[b.relation] ||
    a.title.localeCompare(b.title, 'pt-BR')
  )
}

export async function listDocumentLinks(
  documentId: string,
  session: SessionLike,
): Promise<DocumentLinks> {
  const [self] = await db
    .select({ id: documents.id, parentId: documents.parentId })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)

  if (!self) {
    return { incoming: [], outgoing: [] }
  }

  const rows = await db
    .select({
      sourceId: documentLinks.sourceId,
      targetId: documentLinks.targetId,
      context: documentLinks.context,
    })
    .from(documentLinks)
    .where(
      or(
        eq(documentLinks.sourceId, documentId),
        eq(documentLinks.targetId, documentId),
      ),
    )
    .limit(MAX_DOCUMENT_LINKS)

  const otherIds = [
    ...new Set(
      rows.map((row) =>
        row.sourceId === documentId ? row.targetId : row.sourceId,
      ),
    ),
  ].filter((id) => id !== documentId)

  if (otherIds.length === 0) {
    return { incoming: [], outgoing: [] }
  }

  const others = await db
    .select({
      id: documents.id,
      title: documents.title,
      icon: documents.icon,
      kind: documents.kind,
      parentId: documents.parentId,
    })
    .from(documents)
    .where(and(inArray(documents.id, otherIds), isNull(documents.deletedAt)))

  const access = await Promise.all(
    others.map((other) => getDocumentAccess(other.id, session)),
  )

  const visible = new Map(
    others
      .filter((_, index) => access[index] !== null)
      .map((other) => [other.id, other]),
  )

  const incoming: Array<LinkedDocument> = []
  const outgoing: Array<LinkedDocument> = []

  for (const row of rows) {
    const outward = row.sourceId === documentId
    const other = visible.get(outward ? row.targetId : row.sourceId)

    if (!other) {
      continue
    }

    const linked: LinkedDocument = {
      id: other.id,
      title: other.title,
      icon: other.icon,
      kind: other.kind,
      relation: outward ? relationOf(self, other) : relationOf(other, self),
      context: row.context,
    }

    if (outward) {
      outgoing.push(linked)
    } else {
      incoming.push(linked)
    }
  }

  return {
    incoming: incoming.sort(byRelationThenTitle),
    outgoing: outgoing.sort(byRelationThenTitle),
  }
}

async function selectRows<T>(query: SQL): Promise<Array<T>> {
  const result = (await db.execute(query)) as unknown as [Array<T>, unknown]

  return result[0]
}

export async function organizationGraph(
  viewer: ViewerKeys,
): Promise<OrganizationGraph> {
  const nodes = await selectRows<GraphNode>(sql`
    select
      d.id as id,
      d.title as title,
      d.icon as icon,
      d.kind as kind,
      d.parent_id as parentId,
      d.teamspace_id as teamspaceId
    from documents d
    where d.deleted_at is null
      and d.kind <> 'template'
      and (
        d.kind <> 'row'
        or exists (select 1 from document_links l where l.source_id = d.id)
        or exists (select 1 from document_links l where l.target_id = d.id)
      )
      and ${accessCondition(viewer)}
    order by d.updated_at desc
    limit ${MAX_GRAPH_NODES}
  `)

  const byId = new Map(nodes.map((node) => [node.id, node]))

  const links = await db
    .select({
      source: documentLinks.sourceId,
      target: documentLinks.targetId,
    })
    .from(documentLinks)

  const edges: Array<GraphEdge> = []

  for (const link of links) {
    const source = byId.get(link.source)
    const target = byId.get(link.target)

    if (source && target && source.id !== target.id) {
      edges.push({
        source: source.id,
        target: target.id,
        relation: relationOf(source, target),
      })
    }
  }

  const teamspaceIds = [
    ...new Set(
      nodes
        .map((node) => node.teamspaceId)
        .filter((id): id is string => id !== null),
    ),
  ]

  const named =
    teamspaceIds.length === 0
      ? []
      : await db
          .select({ id: teamspaces.id, name: teamspaces.name })
          .from(teamspaces)
          .where(inArray(teamspaces.id, teamspaceIds))

  return {
    nodes,
    edges,
    teamspaces: named.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
  }
}
