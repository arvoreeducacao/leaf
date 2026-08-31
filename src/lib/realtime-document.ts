import type { PartialBlock } from '@blocknote/core'
import { ServerBlockNoteEditor } from '@blocknote/server-util'
import * as Y from 'yjs'

import { readDocumentContent } from '@/components/editor/content'
import { leafServerSchema } from '@/components/editor/server-schema'
import { realtimeFragmentName } from '@/lib/realtime'

type LeafServerEditor = ServerBlockNoteEditor<
  typeof leafServerSchema.blockSchema,
  typeof leafServerSchema.inlineContentSchema,
  typeof leafServerSchema.styleSchema
>

let cached: LeafServerEditor | null = null

function serverEditor() {
  if (!cached) {
    cached = ServerBlockNoteEditor.create({ schema: leafServerSchema })
  }

  return cached
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
      parsed.blocks as Array<PartialBlock>,
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

  try {
    Y.applyUpdate(doc, state)

    const blocks = serverEditor().yDocToBlocks(doc, realtimeFragmentName)

    return JSON.stringify(blocks)
  } catch {
    return null
  } finally {
    doc.destroy()
  }
}
