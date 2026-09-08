import type { PartialBlock } from '@blocknote/core'
import { ServerBlockNoteEditor } from '@blocknote/server-util'
import * as Y from 'yjs'

import { leafServerSchema } from '@/components/editor/server-schema'
import { sanitizeBlocks } from '@/lib/markdown/sanitize'
import {
  realtimeFragmentName,
  realtimeRoomName,
  realtimeSecretHeader,
} from '@/lib/realtime'
import {
  isRealtimeEnabled,
  realtimeSecret,
  realtimeServerUrl,
} from '@/lib/realtime-config'

export type LiveRoomMode = 'append' | 'replace'

export type LiveRoomWrite = 'applied' | 'no-room' | 'unreachable' | 'disabled'

type LiveRoomState =
  | Readonly<{ status: 'ok'; state: Uint8Array }>
  | Readonly<{ status: 'no-room' }>
  | Readonly<{ status: 'unreachable' }>

type LeafServerEditor = ServerBlockNoteEditor<
  typeof leafServerSchema.blockSchema,
  typeof leafServerSchema.inlineContentSchema,
  typeof leafServerSchema.styleSchema
>

type LeafBlocks = Parameters<LeafServerEditor['blocksToYXmlFragment']>[0]

function roomUrl(documentId: string, suffix = '') {
  const room = encodeURIComponent(realtimeRoomName(documentId))

  return `${realtimeServerUrl()}/rooms/${room}${suffix}`
}

async function readLiveRoom(
  documentId: string,
  secret: string,
): Promise<LiveRoomState> {
  let response: Response

  try {
    response = await fetch(roomUrl(documentId), {
      headers: { [realtimeSecretHeader]: secret },
      cache: 'no-store',
    })
  } catch {
    return { status: 'unreachable' }
  }

  if (response.status === 404) {
    return { status: 'no-room' }
  }

  if (!response.ok) {
    return { status: 'unreachable' }
  }

  const payload = (await response.json().catch(() => null)) as {
    state?: unknown
  } | null

  if (!payload || typeof payload.state !== 'string') {
    return { status: 'unreachable' }
  }

  return {
    status: 'ok',
    state: new Uint8Array(Buffer.from(payload.state, 'base64')),
  }
}

export function liveRoomDelta(
  state: Uint8Array,
  blocks: ReadonlyArray<PartialBlock>,
  mode: LiveRoomMode,
): Uint8Array {
  const doc = new Y.Doc({ gc: true })
  const fragment = doc.getXmlFragment(realtimeFragmentName)

  try {
    Y.applyUpdate(doc, state)

    const editor: LeafServerEditor = ServerBlockNoteEditor.create({
      schema: leafServerSchema,
    })
    const incoming = sanitizeBlocks([...blocks]) as Array<PartialBlock>
    const current =
      mode === 'append' ? editor.yXmlFragmentToBlocks(fragment) : []
    const target = [...current, ...incoming] as LeafBlocks
    const before = Y.encodeStateVector(doc)

    doc.transact(() => {
      editor.blocksToYXmlFragment(target, fragment)
    })

    return Y.encodeStateAsUpdate(doc, before)
  } finally {
    doc.destroy()
  }
}

export async function writeBlocksToLiveRoom(
  documentId: string,
  blocks: ReadonlyArray<PartialBlock>,
  mode: LiveRoomMode,
  authorId: string | null,
): Promise<LiveRoomWrite> {
  const secret = realtimeSecret()

  if (!isRealtimeEnabled() || !secret) {
    return 'disabled'
  }

  const room = await readLiveRoom(documentId, secret)

  if (room.status !== 'ok') {
    return room.status
  }

  const delta = liveRoomDelta(room.state, blocks, mode)
  let response: Response

  try {
    response = await fetch(roomUrl(documentId, '/update'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [realtimeSecretHeader]: secret,
      },
      body: JSON.stringify({
        update: Buffer.from(delta).toString('base64'),
        authorId,
      }),
    })
  } catch {
    return 'unreachable'
  }

  if (response.status === 404) {
    return 'no-room'
  }

  if (!response.ok) {
    return 'unreachable'
  }

  return 'applied'
}
