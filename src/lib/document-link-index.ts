import { desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'

import { mentionLabel } from '@/components/editor/mention-config'
import { db } from '@/db'
import { documentLinkScans, documentLinks, documents } from '@/db/schema'
import { documentIdFromHref, documentIdsInContent } from '@/lib/document-links'
import { authIssuer } from '@/lib/mcp-config'

export const LINK_CONTEXT_MAX = 200

const LINK_CONTEXT_LEAD = 80
const ELLIPSIS = '…'

export type ExtractedLink = Readonly<{ targetId: string; context: string }>

type Segment = Readonly<{ text: string; href: string | null }>

type SourceRow = Readonly<{
  id: string
  content: string | null
  updatedAt: Date
}>

type InlineLike = Readonly<{
  type?: unknown
  text?: unknown
  href?: unknown
  content?: unknown
  rows?: unknown
  props?: Readonly<{ name?: unknown }>
}>

function collectSegments(
  node: unknown,
  href: string | null,
  segments: Array<Segment>,
) {
  if (Array.isArray(node)) {
    for (const item of node) {
      collectSegments(item, href, segments)
    }

    return
  }

  if (!node || typeof node !== 'object') {
    return
  }

  const inline = node as InlineLike
  const linkHref =
    inline.type === 'link' && typeof inline.href === 'string'
      ? inline.href
      : href

  if (typeof inline.text === 'string') {
    segments.push({ text: inline.text, href: linkHref })
  }

  if (inline.type === 'mention' && typeof inline.props?.name === 'string') {
    segments.push({ text: mentionLabel(inline.props.name), href: null })
  }

  if (inline.content !== undefined) {
    collectSegments(inline.content, linkHref, segments)
  }

  if (!Array.isArray(inline.rows)) {
    return
  }

  for (const row of inline.rows) {
    const cells = (row as { cells?: unknown })?.cells

    if (!Array.isArray(cells)) {
      continue
    }

    for (const cell of cells) {
      collectSegments(cell, href, segments)
      segments.push({ text: ' ', href: null })
    }
  }
}

function visitBlocks(
  blocks: unknown,
  visit: (segments: ReadonlyArray<Segment>) => void,
) {
  if (!Array.isArray(blocks)) {
    return
  }

  for (const block of blocks) {
    if (!block || typeof block !== 'object') {
      continue
    }

    const segments: Array<Segment> = []

    collectSegments((block as { content?: unknown }).content, null, segments)

    if (segments.length > 0) {
      visit(segments)
    }

    visitBlocks((block as { children?: unknown }).children, visit)
  }
}

function excerpt(characters: ReadonlyArray<string>, start: number, end: number) {
  const total = characters.length
  let from = 0
  let to = total

  if (total > LINK_CONTEXT_MAX) {
    from = Math.max(0, start - LINK_CONTEXT_LEAD, end - LINK_CONTEXT_MAX)
    to = Math.min(total, from + LINK_CONTEXT_MAX)
    from = Math.max(0, to - LINK_CONTEXT_MAX)
  }

  const body = characters.slice(from, to).join('').replace(/\s+/g, ' ').trim()

  return `${from > 0 ? ELLIPSIS : ''}${body}${to < total ? ELLIPSIS : ''}`
}

function contextsOf(
  segments: ReadonlyArray<Segment>,
  sourceId: string,
  origin: string | undefined,
  contexts: Map<string, string>,
) {
  const characters: Array<string> = []
  const spans: Array<{ id: string; start: number; end: number }> = []
  let previous: string | null = null

  for (const segment of segments) {
    const start = characters.length

    characters.push(...Array.from(segment.text))

    const id =
      segment.href === null ? null : documentIdFromHref(segment.href, origin)

    if (id === null || id === sourceId) {
      previous = null

      continue
    }

    const last = spans[spans.length - 1]

    if (previous === id && last) {
      last.end = characters.length
    } else {
      spans.push({ id, start, end: characters.length })
    }

    previous = id
  }

  for (const span of spans) {
    if (!contexts.has(span.id)) {
      contexts.set(span.id, excerpt(characters, span.start, span.end))
    }
  }
}

export function linksInContent(
  content: string | null | undefined,
  sourceId: string,
  origin?: string,
): Array<ExtractedLink> {
  const ids = documentIdsInContent(content, origin).filter(
    (id) => id !== sourceId,
  )

  if (ids.length === 0) {
    return []
  }

  const contexts = new Map<string, string>()

  try {
    visitBlocks(JSON.parse(content as string), (segments) =>
      contextsOf(segments, sourceId, origin, contexts),
    )
  } catch {
    contexts.clear()
  }

  return ids.map((targetId) => ({
    targetId,
    context: contexts.get(targetId) ?? '',
  }))
}

async function writeLinks(source: SourceRow) {
  const extracted = linksInContent(source.content, source.id, authIssuer())

  const existing =
    extracted.length === 0
      ? []
      : await db
          .select({ id: documents.id })
          .from(documents)
          .where(
            inArray(
              documents.id,
              extracted.map((link) => link.targetId),
            ),
          )

  const known = new Set(existing.map((row) => row.id))

  const rows = extracted
    .filter((link) => known.has(link.targetId))
    .map((link) => ({
      sourceId: source.id,
      targetId: link.targetId,
      context: link.context,
    }))

  await db.delete(documentLinks).where(eq(documentLinks.sourceId, source.id))

  if (rows.length > 0) {
    await db
      .insert(documentLinks)
      .values(rows)
      .onDuplicateKeyUpdate({ set: { context: sql`values(context)` } })
  }

  await db
    .insert(documentLinkScans)
    .values({ documentId: source.id, scannedAt: source.updatedAt })
    .onDuplicateKeyUpdate({ set: { scannedAt: source.updatedAt } })
}

const sourceColumns = {
  id: documents.id,
  content: documents.content,
  updatedAt: documents.updatedAt,
}

export async function indexDocumentLinks(documentId: string) {
  const [row] = await db
    .select(sourceColumns)
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1)

  if (row) {
    await writeLinks(row)
  }
}

export async function reconcileDocumentLinks(budget: number): Promise<number> {
  if (budget <= 0) {
    return 0
  }

  const stale = await db
    .select(sourceColumns)
    .from(documents)
    .leftJoin(documentLinkScans, eq(documentLinkScans.documentId, documents.id))
    .where(
      or(
        isNull(documentLinkScans.documentId),
        ne(documentLinkScans.scannedAt, documents.updatedAt),
      ),
    )
    .orderBy(desc(documents.updatedAt))
    .limit(budget)

  for (const row of stale) {
    await writeLinks(row)
  }

  return stale.length
}
