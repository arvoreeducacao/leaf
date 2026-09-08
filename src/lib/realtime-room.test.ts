import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { realtimeFragmentName, realtimeSecretHeader } from './realtime'
import {
  contentFromRealtimeState,
  seedUpdateFromContent,
} from './realtime-document'
import { liveRoomDelta, writeBlocksToLiveRoom } from './realtime-room'

const sample = JSON.stringify([
  {
    id: 'block-1',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: 'Collaboration', styles: {} }],
    children: [],
  },
  {
    id: 'block-2',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Two people on the same text', styles: {} }],
    children: [],
  },
])

function paragraph(text: string) {
  return {
    type: 'paragraph' as const,
    content: [{ type: 'text' as const, text, styles: {} }],
  }
}

function seed(content: string) {
  const result = seedUpdateFromContent(content)

  if (result.status !== 'ok') {
    throw new Error('seed unexpectedly unreadable')
  }

  return result.update
}

function merged(...updates: Array<Uint8Array>) {
  const doc = new Y.Doc({ gc: true })

  doc.getXmlFragment(realtimeFragmentName)

  for (const update of updates) {
    Y.applyUpdate(doc, update)
  }

  const state = Y.encodeStateAsUpdate(doc)

  doc.destroy()

  return state
}

function textOf(state: Uint8Array) {
  return contentFromRealtimeState(state) ?? ''
}

describe('liveRoomDelta', () => {
  it('appends after what the room already has', () => {
    const state = seed(sample)
    const delta = liveRoomDelta(state, [paragraph('Nova linha')], 'append')
    const text = textOf(merged(state, delta))

    expect(text).toContain('Collaboration')
    expect(text).toContain('Nova linha')
    expect(text.indexOf('Two people')).toBeLessThan(text.indexOf('Nova linha'))
  })

  it('replaces the whole body', () => {
    const state = seed(sample)
    const delta = liveRoomDelta(state, [paragraph('Só isto.')], 'replace')
    const text = textOf(merged(state, delta))

    expect(text).toContain('Só isto.')
    expect(text).not.toContain('Collaboration')
    expect(text).not.toContain('Two people')
  })

  it('keeps what someone typed in the room meanwhile', () => {
    const state = seed(sample)
    const fromApp = liveRoomDelta(state, [paragraph('Vinda do app')], 'append')
    const fromPerson = liveRoomDelta(state, [paragraph('Enquanto isso')], 'append')
    const text = textOf(merged(state, fromPerson, fromApp))

    expect(text).toContain('Vinda do app')
    expect(text).toContain('Enquanto isso')
    expect(text).toContain('Collaboration')
  })

  it('sends only the change, not the document again', () => {
    const long = JSON.stringify(
      Array.from({ length: 40 }, (_, index) => ({
        id: `block-${index}`,
        type: 'paragraph',
        props: {},
        content: [{ type: 'text', text: `Parágrafo ${index} `.repeat(20), styles: {} }],
        children: [],
      })),
    )
    const state = seed(long)
    const delta = liveRoomDelta(state, [paragraph('Fim')], 'append')

    expect(delta.byteLength).toBeLessThan(state.byteLength / 4)
    expect(textOf(merged(state, delta))).toContain('Parágrafo 39')
  })
})

describe('writeBlocksToLiveRoom', () => {
  const secret = 'segredo-teste'
  const saved = {
    LEAF_REALTIME: process.env.LEAF_REALTIME,
    LEAF_REALTIME_SECRET: process.env.LEAF_REALTIME_SECRET,
    LEAF_REALTIME_SERVER_URL: process.env.LEAF_REALTIME_SERVER_URL,
  }
  let server: Server | null = null

  afterEach(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }

    if (server) {
      await new Promise((resolve) => server?.close(resolve))
      server = null
    }
  })

  async function fakeRealtime(state: Uint8Array | null) {
    const posted: Array<{ path: string; body: Record<string, unknown> }> = []
    const seen: Array<string | undefined> = []

    server = createServer((request, response) => {
      const path = decodeURIComponent(
        new URL(request.url ?? '/', 'http://localhost').pathname,
      )

      seen.push(request.headers[realtimeSecretHeader] as string | undefined)

      if (request.headers[realtimeSecretHeader] !== secret) {
        response.writeHead(404).end('{"status":"not-found"}')

        return
      }

      if (request.method === 'GET' && path === '/rooms/doc:abc' && state) {
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(
          JSON.stringify({
            status: 'ok',
            state: Buffer.from(state).toString('base64'),
            connections: 1,
          }),
        )

        return
      }

      if (request.method === 'POST' && path === '/rooms/doc:abc/update' && state) {
        const chunks: Array<Buffer> = []

        request.on('data', (chunk: Buffer) => chunks.push(chunk))
        request.on('end', () => {
          posted.push({
            path,
            body: JSON.parse(Buffer.concat(chunks).toString('utf8')),
          })
          response.writeHead(200, { 'content-type': 'application/json' })
          response.end('{"status":"ok","applied":true}')
        })

        return
      }

      response.writeHead(404, { 'content-type': 'application/json' })
      response.end('{"status":"no-room"}')
    })

    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve))

    const port = (server.address() as AddressInfo).port

    process.env.LEAF_REALTIME = 'on'
    process.env.LEAF_REALTIME_SECRET = secret
    process.env.LEAF_REALTIME_SERVER_URL = `http://127.0.0.1:${port}/`

    return { posted, seen, port }
  }

  it('hands the room a delta it can apply, signed with the secret', async () => {
    const state = seed(sample)
    const fake = await fakeRealtime(state)

    const result = await writeBlocksToLiveRoom(
      'abc',
      [paragraph('Chegou pelo MCP')],
      'append',
      'pessoa-mcp',
    )

    expect(result).toBe('applied')
    expect(fake.seen).toEqual([secret, secret])
    expect(fake.posted).toHaveLength(1)
    expect(fake.posted[0]?.body.authorId).toBe('pessoa-mcp')

    const update = new Uint8Array(
      Buffer.from(fake.posted[0]?.body.update as string, 'base64'),
    )
    const text = textOf(merged(state, update))

    expect(text).toContain('Collaboration')
    expect(text).toContain('Chegou pelo MCP')
  })

  it('says no-room when the server has no live session for the page', async () => {
    await fakeRealtime(null)

    expect(
      await writeBlocksToLiveRoom('abc', [paragraph('x')], 'append', null),
    ).toBe('no-room')
  })

  it('says unreachable when nothing answers', async () => {
    const fake = await fakeRealtime(seed(sample))

    await new Promise((resolve) => server?.close(resolve))
    server = null
    process.env.LEAF_REALTIME_SERVER_URL = `http://127.0.0.1:${fake.port}`

    expect(
      await writeBlocksToLiveRoom('abc', [paragraph('x')], 'append', null),
    ).toBe('unreachable')
  })

  it('says disabled when realtime is off', async () => {
    const fake = await fakeRealtime(seed(sample))

    process.env.LEAF_REALTIME = 'off'

    expect(
      await writeBlocksToLiveRoom('abc', [paragraph('x')], 'append', null),
    ).toBe('disabled')
    expect(fake.seen).toHaveLength(0)
  })
})
