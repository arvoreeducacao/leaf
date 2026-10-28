import type { PartialBlock } from '@blocknote/core'
import { and, eq, isNull, like, ne, or } from 'drizzle-orm'

import { db } from '@/db'
import { documentLinkScans, documentLinks, documents } from '@/db/schema'
import { persistDocumentContentIfUnchanged } from '@/lib/document-content'
import { retitleDocumentLinks } from '@/lib/document-link-titles'
import { maxLinkedDocuments } from '@/lib/document-links'
import { authIssuer } from '@/lib/mcp-config'
import { rewriteLiveRoomBlocks } from '@/lib/realtime-room'

const candidateColumns = {
  id: documents.id,
  content: documents.content,
  updatedAt: documents.updatedAt,
}

async function documentsLinkingTo(documentId: string) {
  const indexed = await db
    .select(candidateColumns)
    .from(documentLinks)
    .innerJoin(documents, eq(documents.id, documentLinks.sourceId))
    .where(
      and(eq(documentLinks.targetId, documentId), isNull(documents.deletedAt)),
    )
    .limit(maxLinkedDocuments)

  const unscanned = await db
    .select(candidateColumns)
    .from(documents)
    .leftJoin(documentLinkScans, eq(documentLinkScans.documentId, documents.id))
    .where(
      and(
        isNull(documents.deletedAt),
        or(
          isNull(documentLinkScans.documentId),
          ne(documentLinkScans.scannedAt, documents.updatedAt),
        ),
        like(documents.content, `%/doc/${documentId.replace(/[%_]/g, '\\$&')}%`),
      ),
    )
    .limit(maxLinkedDocuments)

  const byId = new Map(
    [...indexed, ...unscanned].map((candidate) => [candidate.id, candidate]),
  )

  return [...byId.values()].slice(0, maxLinkedDocuments)
}

export async function retitleLinksToDocument(
  documentId: string,
  previousTitle: string,
  title: string,
  authorId: string | null,
): Promise<number> {
  const previous = previousTitle.trim()
  const next = title.trim()

  if (previous === next || previous.length === 0 || next.length === 0) {
    return 0
  }

  const candidates = await documentsLinkingTo(documentId)

  const origin = authIssuer()

  function retitle(blocks: Array<PartialBlock>) {
    return retitleDocumentLinks(
      blocks,
      documentId,
      previousTitle,
      title,
      origin,
    ) as { blocks: Array<PartialBlock>; changed: boolean }
  }

  let retitled = 0

  for (const candidate of candidates) {
    if (candidate.id === documentId || !candidate.content) {
      continue
    }

    const live = await rewriteLiveRoomBlocks(candidate.id, retitle, authorId)

    if (live === 'applied') {
      retitled += 1

      continue
    }

    if (live === 'untouched') {
      continue
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(candidate.content)
    } catch {
      continue
    }

    if (!Array.isArray(parsed)) {
      continue
    }

    const result = retitle(parsed as Array<PartialBlock>)

    if (!result.changed) {
      continue
    }

    const outcome = await persistDocumentContentIfUnchanged(
      candidate.id,
      JSON.stringify(result.blocks),
      authorId,
      candidate.updatedAt,
    )

    if (outcome === 'written') {
      retitled += 1
    }
  }

  return retitled
}
