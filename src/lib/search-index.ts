import { type SQL, sql } from 'drizzle-orm'

import { blocksToPlainText } from '@/components/editor/text-stats'
import { db } from '@/db'

export const HIGHLIGHT_START = String.fromCharCode(2)
export const HIGHLIGHT_END = String.fromCharCode(3)

export const MAX_SEARCH_RESULTS = 8
export const MAX_ASK_SOURCES = 6
export const MAX_RECENT_RESULTS = 7

const MAX_QUERY_TOKENS = 8
const MAX_ASK_TOKENS = 12
const MIN_ASK_TOKEN_LENGTH = 3
const MAX_TOKEN_LENGTH = 32
const MAX_INDEXED_BODY = 200_000
const SNIPPET_WORDS = 12
const SNIPPET_LEAD_WORDS = 4
const ELLIPSIS = '…'
const WORD_PATTERN = /[\p{L}\p{N}]+/gu
const RECONCILE_INTERVAL = 5 * 60 * 1000

export type SearchSegment = Readonly<{ text: string; highlight: boolean }>

export type SearchHit = Readonly<{
  id: string
  title: string
  icon: string | null
  segments: Array<SearchSegment>
}>

export type WorkspaceSearchResult = Readonly<{
  documents: Array<SearchHit>
  recent: boolean
}>

export function queryTokens(query: string): Array<string> {
  return query
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0)
    .slice(0, MAX_QUERY_TOKENS)
    .map((token) => token.slice(0, MAX_TOKEN_LENGTH))
    .filter((token) => token.length > 0)
}

const askStopWords = new Set([
  'aos',
  'como',
  'com',
  'das',
  'dos',
  'ela',
  'ele',
  'eles',
  'essa',
  'esse',
  'esta',
  'este',
  'isso',
  'meu',
  'minha',
  'nas',
  'nos',
  'nossa',
  'nosso',
  'para',
  'pela',
  'pelo',
  'por',
  'pra',
  'qual',
  'quais',
  'quando',
  'que',
  'quem',
  'sem',
  'ser',
  'seu',
  'sua',
  'tem',
  'ter',
  'uma',
  'and',
  'are',
  'can',
  'does',
  'for',
  'from',
  'how',
  'the',
  'what',
  'when',
  'where',
  'which',
  'who',
  'why',
  'with',
])

export function askTokens(query: string): Array<string> {
  return query
    .normalize('NFC')
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.slice(0, MAX_TOKEN_LENGTH))
    .filter(
      (token) =>
        token.length >= MIN_ASK_TOKEN_LENGTH &&
        !askStopWords.has(foldForSearch(token)),
    )
    .slice(0, MAX_ASK_TOKENS)
}

export function buildAskMatchExpression(query: string): string | null {
  const tokens = askTokens(query)

  if (tokens.length === 0) {
    return null
  }

  return tokens.map((token) => `${token}*`).join(' ')
}

export function buildMatchExpression(query: string): string | null {
  const tokens = queryTokens(query)

  if (tokens.length === 0) {
    return null
  }

  return tokens.map((token) => `+${token}*`).join(' ')
}

export function foldForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
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

export function buildSnippet(body: string, tokens: Array<string>): string {
  const words = [...body.matchAll(WORD_PATTERN)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    folded: foldForSearch(match[0]),
  }))

  if (words.length === 0) {
    return ''
  }

  const folded = tokens.map((token) => foldForSearch(token))
  const matched = words.map((word) =>
    folded.some((token) => token.length > 0 && word.folded.startsWith(token)),
  )

  const first = matched.indexOf(true)
  const start = first < 0 ? 0 : Math.max(0, first - SNIPPET_LEAD_WORDS)
  const end = Math.min(words.length, start + SNIPPET_WORDS)

  let snippet = start > 0 ? ELLIPSIS : ''
  let cursor = words[start].start

  for (let position = start; position < end; position += 1) {
    const word = words[position]

    snippet += body.slice(cursor, word.start)
    snippet += matched[position]
      ? `${HIGHLIGHT_START}${body.slice(word.start, word.end)}${HIGHLIGHT_END}`
      : body.slice(word.start, word.end)
    cursor = word.end
  }

  return end < words.length ? `${snippet}${ELLIPSIS}` : snippet
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

async function selectRows<T>(query: SQL): Promise<Array<T>> {
  const result = (await db.execute(query)) as unknown as [Array<T>, unknown]

  return result[0]
}

type IndexableRow = Readonly<{
  id: string
  title: string
  content: string | null
  updatedAt: string
}>

async function writeIndexRow(row: IndexableRow) {
  await db.execute(sql`
    insert into documents_fts (document_id, title, body, indexed_at)
    values (${row.id}, ${row.title}, ${documentBodyText(row.content)}, ${row.updatedAt})
    on duplicate key update
      title = values(title),
      body = values(body),
      indexed_at = values(indexed_at)
  `)
}

export async function removeDocumentFromIndex(documentId: string) {
  await db.execute(
    sql`delete from documents_fts where document_id = ${documentId}`,
  )
}

export async function indexDocument(documentId: string) {
  const rows = await selectRows<IndexableRow>(
    sql`select id, title, content, updated_at as updatedAt from documents where id = ${documentId}`,
  )

  const row = rows[0]

  if (!row) {
    await removeDocumentFromIndex(documentId)

    return
  }

  await writeIndexRow(row)
}

let reconcileDueAt = 0
let reconcileInFlight: Promise<void> | null = null

export function scheduleSearchIndexReconcile() {
  const now = Date.now()

  if (reconcileInFlight || now < reconcileDueAt) {
    return
  }

  reconcileDueAt = now + RECONCILE_INTERVAL
  reconcileInFlight = reconcileSearchIndex()
    .catch(() => undefined)
    .finally(() => {
      reconcileInFlight = null
    })
}

export async function reconcileSearchIndex() {
  await db.execute(
    sql`delete f from documents_fts f left join documents d on d.id = f.document_id where d.id is null`,
  )

  const stale = await selectRows<IndexableRow>(sql`
    select d.id as id, d.title as title, d.content as content, d.updated_at as updatedAt
    from documents d
    left join documents_fts f on f.document_id = d.id
    where f.document_id is null or f.indexed_at <> d.updated_at
  `)

  for (const row of stale) {
    await writeIndexRow(row)
  }
}

export type ViewerKeys = Readonly<{ userId: string; email: string }>

function accessCondition(viewer: ViewerKeys) {
  return sql`(
    d.owner_id = ${viewer.userId}
    or exists (
      select 1 from document_shares s
      where s.document_id = d.id and s.grantee_email = ${viewer.email.toLowerCase()}
    )
    or (
      d.teamspace_id is not null and exists (
        select 1 from teamspace_members tm
        where tm.teamspace_id = d.teamspace_id and tm.user_id = ${viewer.userId}
      )
    )
    or (
      d.teamspace_id is not null and exists (
        select 1 from teamspaces ts
        join organization_members tm2 on tm2.org_id = ts.org_id
        where ts.id = d.teamspace_id
          and ts.access = 'open'
          and tm2.user_id = ${viewer.userId}
      )
    )
    or (
      d.org_id is not null and d.org_access is not null and exists (
        select 1 from organization_members m
        where m.org_id = d.org_id and m.user_id = ${viewer.userId}
      )
    )
  )`
}

type HitRow = Readonly<{ id: string; title: string; body: string | null }>

type IconHitRow = HitRow & Readonly<{ icon: string | null }>

export async function searchAccessibleDocuments(
  viewer: ViewerKeys,
  query: string,
  limit: number = MAX_SEARCH_RESULTS,
): Promise<Array<SearchHit>> {
  const match = buildMatchExpression(query)

  if (!match) {
    return []
  }

  const rows = await selectRows<IconHitRow>(sql`
    select
      d.id as id,
      d.title as title,
      d.icon as icon,
      f.body as body
    from documents_fts f
    join documents d on d.id = f.document_id
    where match(f.title, f.body) against (${match} in boolean mode)
      and d.deleted_at is null
      and ${accessCondition(viewer)}
    order by
      match(f.title) against (${match} in boolean mode) * 10
      + match(f.body) against (${match} in boolean mode) desc,
      d.updated_at desc
    limit ${limit}
  `)

  const tokens = queryTokens(query)

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    icon: row.icon,
    segments: parseSnippet(buildSnippet(row.body ?? '', tokens)),
  }))
}

export type DocumentPassage = Readonly<{
  id: string
  title: string
  body: string
}>

export async function searchAccessibleDocumentBodies(
  viewer: ViewerKeys,
  query: string,
  limit: number = MAX_ASK_SOURCES,
): Promise<Array<DocumentPassage>> {
  const match = buildAskMatchExpression(query)

  if (!match) {
    return []
  }

  const rows = await selectRows<HitRow>(sql`
    select
      d.id as id,
      d.title as title,
      f.body as body
    from documents_fts f
    join documents d on d.id = f.document_id
    where match(f.title, f.body) against (${match} in boolean mode)
      and d.deleted_at is null
      and ${accessCondition(viewer)}
    order by
      match(f.title) against (${match} in boolean mode) * 10
      + match(f.body) against (${match} in boolean mode) desc,
      d.updated_at desc
    limit ${limit}
  `)

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body ?? '',
  }))
}

export async function listRecentAccessibleDocuments(
  viewer: ViewerKeys,
  limit: number = MAX_RECENT_RESULTS,
): Promise<Array<SearchHit>> {
  const rows = await selectRows<
    Readonly<{ id: string; title: string; icon: string | null }>
  >(sql`
    select d.id as id, d.title as title, d.icon as icon
    from documents d
    where d.deleted_at is null and ${accessCondition(viewer)}
    order by d.updated_at desc
    limit ${limit}
  `)

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    icon: row.icon,
    segments: [],
  }))
}
