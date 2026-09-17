import type { PartialBlock } from '@blocknote/core'
import { and, isNull, like } from 'drizzle-orm'

import { db } from '@/db'
import { documents } from '@/db/schema'
import { persistDocumentContentIfUnchanged } from '@/lib/document-content'
import { retitleDocumentLinks } from '@/lib/document-link-titles'
import { maxLinkedDocuments } from '@/lib/document-links'
import { authIssuer } from '@/lib/mcp-config'
import { rewriteLiveRoomBlocks } from '@/lib/realtime-room'

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

  const candidates = await db
    .select({
      id: documents.id,
      content: documents.content,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(
      and(
        isNull(documents.deletedAt),
        like(documents.content, `%/doc/${documentId.replace(/[%_]/g, '\\$&')}%`),
      ),
    )
    .limit(maxLinkedDocuments)

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
