import { sql } from 'drizzle-orm'

import { blocksToPlainText } from '@/components/editor/text-stats'
import { db } from '@/db'

export const HIGHLIGHT_START = String.fromCharCode(2)
export const HIGHLIGHT_END = String.fromCharCode(3)

export const MAX_SEARCH_RESULTS = 8
export const MAX_RECENT_RESULTS = 7

const MAX_QUERY_TOKENS = 8
const MAX_TOKEN_LENGTH = 32
const MAX_INDEXED_BODY = 200_000

export type SearchSegment = Readonly<{ text: string; highlight: boolean }>

export type SearchHit = Readonly<{
  id: string
  title: string
  segments: Array<SearchSegment>
}>

export function buildMatchExpression(query: string): string | null {
  const tokens = query
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0)
    .slice(0, MAX_QUERY_TOKENS)
    .map((token) => token.slice(0, MAX_TOKEN_LENGTH).replace(/"/g, ''))
    .filter((token) => token.length > 0)

  if (tokens.length === 0) {
    return null
  }

  return tokens.map((token) => `"${token}"*`).join(' ')
}

export function parseSnippet(value: string): Array<SearchSegment> {
  const segments: Array<SearchSegment> = []

  for (const chunk of value.split(HIGHLIGHT_START)) {
    const [highlighted, ...rest] = chunk.split(HIGHLIGHT_END)

    if (rest.length === 0) {
      if (highlighted.length > 0) {
        segments.push({ text: highlighted, highlight: false })
      }

      continue
    }

    if (highlighted.length > 0) {
      segments.push({ text: highlighted, highlight: true })
    }

    const tail = rest.join(HIGHLIGHT_END)

    if (tail.length > 0) {
      segments.push({ text: tail, highlight: false })
    }
  }

  return segments
}

export function documentBodyText(content: string | null): string {
  if (!content) {
    return ''
  }

  try {
    return blocksToPlainText(JSON.parse(content))
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_INDEXED_BODY)
  } catch {
    return ''
  }
}

type IndexableRow = Readonly<{
  id: string
  title: string
  content: string | null
  updatedAt: number
}>

function writeIndexRow(row: IndexableRow) {
  db.run(sql`delete from documents_fts where document_id = ${row.id}`)
  db.run(
    sql`insert into documents_fts (document_id, title, body, indexed_at) values (${row.id}, ${row.title}, ${documentBodyText(row.content)}, ${String(row.updatedAt)})`,
  )
}

export function removeDocumentFromIndex(documentId: string) {
  db.run(sql`delete from documents_fts where document_id = ${documentId}`)
}

export function indexDocument(documentId: string) {
  const rows = db.all<IndexableRow>(
    sql`select id, title, content, updated_at as updatedAt from documents where id = ${documentId}`,
  )

  const row = rows[0]

  if (!row) {
    removeDocumentFromIndex(documentId)

    return
  }

  writeIndexRow(row)
}

export function reconcileSearchIndex() {
  db.run(
    sql`delete from documents_fts where document_id not in (select id from documents)`,
  )

  const stale = db.all<IndexableRow>(sql`
    select d.id as id, d.title as title, d.content as content, d.updated_at as updatedAt
    from documents d
    left join documents_fts f on f.document_id = d.id
    where f.document_id is null or f.indexed_at <> cast(d.updated_at as text)
  `)

  for (const row of stale) {
    writeIndexRow(row)
  }
}

type ViewerKeys = Readonly<{ userId: string; email: string }>

function accessCondition(viewer: ViewerKeys) {
  return sql`(
    d.owner_id = ${viewer.userId}
    or exists (
      select 1 from document_shares s
      where s.document_id = d.id and s.grantee_email = ${viewer.email.toLowerCase()}
    )
    or (
      d.org_id is not null and d.org_access is not null and exists (
        select 1 from organization_members m
        where m.org_id = d.org_id and m.user_id = ${viewer.userId}
      )
    )
  )`
}

type HitRow = Readonly<{ id: string; title: string; excerpt: string }>

export function searchAccessibleDocuments(
  viewer: ViewerKeys,
  query: string,
  limit: number = MAX_SEARCH_RESULTS,
): Array<SearchHit> {
  const match = buildMatchExpression(query)

  if (!match) {
    return []
  }

  reconcileSearchIndex()

  const rows = db.all<HitRow>(sql`
    select
      d.id as id,
      d.title as title,
      snippet(documents_fts, 2, char(2), char(3), '…', 12) as excerpt
    from documents_fts
    join documents d on d.id = documents_fts.document_id
    where documents_fts match ${match}
      and d.deleted_at is null
      and ${accessCondition(viewer)}
    order by bm25(documents_fts, 0.0, 10.0, 1.0, 0.0)
    limit ${limit}
  `)

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    segments: parseSnippet(row.excerpt ?? ''),
  }))
}

export function listRecentAccessibleDocuments(
  viewer: ViewerKeys,
  limit: number = MAX_RECENT_RESULTS,
): Array<SearchHit> {
  const rows = db.all<Readonly<{ id: string; title: string }>>(sql`
    select d.id as id, d.title as title
    from documents d
    where d.deleted_at is null and ${accessCondition(viewer)}
    order by d.updated_at desc
    limit ${limit}
  `)

  return rows.map((row) => ({ id: row.id, title: row.title, segments: [] }))
}
