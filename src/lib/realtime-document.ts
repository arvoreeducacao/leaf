import type { PartialBlock } from '@blocknote/core'
import { ServerBlockNoteEditor } from '@blocknote/server-util'
import * as Y from 'yjs'

import { readDocumentContent } from '@/components/editor/content'
import { leafServerSchema } from '@/components/editor/server-schema'
import { sanitizeBlocks } from '@/lib/markdown/sanitize'
import { realtimeFragmentName } from '@/lib/realtime'

type LeafServerEditor = ServerBlockNoteEditor<
  typeof leafServerSchema.blockSchema,
  typeof leafServerSchema.inlineContentSchema,
  typeof leafServerSchema.styleSchema
>

function serverEditor(): LeafServerEditor {
  return ServerBlockNoteEditor.create({ schema: leafServerSchema })
}

export type SeedResult =
  | Readonly<{ status: 'ok'; update: Uint8Array }>
  | Readonly<{ status: 'unreadable' }>

export function seedUpdateFromContent(content: string | null): SeedResult {
  const parsed = readDocumentContent(content)

  if (parsed.status === 'unreadable') {
    return { status: 'unreadable' }
  }

  try {
    const doc = serverEditor().blocksToYDoc(
      sanitizeBlocks(parsed.blocks) as Array<PartialBlock>,
      realtimeFragmentName,
    )

    const update = Y.encodeStateAsUpdate(doc)

    doc.destroy()

    return { status: 'ok', update }
  } catch {
    return { status: 'unreadable' }
  }
}

export function contentFromRealtimeState(state: Uint8Array): string | null {
  const doc = new Y.Doc({ gc: true })

  doc.getXmlFragment(realtimeFragmentName)

  try {
    Y.applyUpdate(doc, state)

    return JSON.stringify(
      serverEditor().yDocToBlocks(doc, realtimeFragmentName),
    )
  } catch {
    return null
  } finally {
    doc.destroy()
  }
}
