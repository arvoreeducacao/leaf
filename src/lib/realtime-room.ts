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

export type LiveRoomWrite =
  | 'applied'
  | 'no-room'
  | 'unreachable'
  | 'misconfigured'
  | 'disabled'

type LiveRoomState =
  | Readonly<{ status: 'ok'; state: Uint8Array }>
  | Readonly<{ status: 'no-room' }>
  | Readonly<{ status: 'unreachable' }>
  | Readonly<{ status: 'misconfigured' }>

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

const reportedWrongAddresses = new Set<string>()

function reportWrongRoomAddress(url: string) {
  const origin = new URL(url).origin

  if (reportedWrongAddresses.has(origin)) {
    return
  }

  reportedWrongAddresses.add(origin)

  console.error(
    `[leaf] ${url} did not answer as the collaboration server's room API. Writes into open documents are being dropped. Set LEAF_REALTIME_SERVER_URL to its internal address.`,
  )
}

export function resetWrongRoomAddressReports() {
  reportedWrongAddresses.clear()
}

async function readLiveRoom(
  documentId: string,
  secret: string,
): Promise<LiveRoomState> {
  const url = roomUrl(documentId)
  let response: Response

  try {
    response = await fetch(url, {
      headers: { [realtimeSecretHeader]: secret },
      cache: 'no-store',
    })
  } catch {
    return { status: 'unreachable' }
  }

  if (!response.ok && response.status !== 404) {
    return { status: 'unreachable' }
  }

  const payload = (await response.json().catch(() => null)) as {
    status?: unknown
    state?: unknown
  } | null

  if (response.status === 404) {
    if (payload && typeof payload.status === 'string') {
      return { status: 'no-room' }
    }

    reportWrongRoomAddress(url)

    return { status: 'misconfigured' }
  }

  if (!payload || typeof payload.state !== 'string') {
    reportWrongRoomAddress(url)

    return { status: 'misconfigured' }
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

export function liveRoomBlocks(state: Uint8Array): Array<PartialBlock> {
  const doc = new Y.Doc({ gc: true })
  const fragment = doc.getXmlFragment(realtimeFragmentName)

  try {
    Y.applyUpdate(doc, state)

    const editor: LeafServerEditor = ServerBlockNoteEditor.create({
      schema: leafServerSchema,
    })

    return editor.yXmlFragmentToBlocks(fragment) as Array<PartialBlock>
  } finally {
    doc.destroy()
  }
}

async function postLiveRoomUpdate(
  documentId: string,
  delta: Uint8Array,
  authorId: string | null,
  secret: string,
): Promise<LiveRoomWrite> {
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

  return postLiveRoomUpdate(
    documentId,
    liveRoomDelta(room.state, blocks, mode),
    authorId,
    secret,
  )
}

export async function rewriteLiveRoomBlocks(
  documentId: string,
  rewrite: (
    blocks: Array<PartialBlock>,
  ) => Readonly<{ blocks: Array<PartialBlock>; changed: boolean }>,
  authorId: string | null,
): Promise<LiveRoomWrite | 'untouched'> {
  const secret = realtimeSecret()

  if (!isRealtimeEnabled() || !secret) {
    return 'disabled'
  }

  const room = await readLiveRoom(documentId, secret)

  if (room.status !== 'ok') {
    return room.status
  }

  const rewritten = rewrite(liveRoomBlocks(room.state))

  if (!rewritten.changed) {
    return 'untouched'
  }

  return postLiveRoomUpdate(
    documentId,
    liveRoomDelta(room.state, rewritten.blocks, 'replace'),
    authorId,
    secret,
  )
}
