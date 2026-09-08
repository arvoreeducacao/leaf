import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { WebsocketProvider } from 'y-websocket'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { realtimeFragmentName, realtimeSecretHeader } from './realtime'
import {
  contentFromRealtimeState,
  seedUpdateFromContent,
} from './realtime-document'
import { liveRoomDelta } from './realtime-room'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const secret = 'segredo-teste'
const sample = JSON.stringify([
  {
    id: 'block-1',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Texto que já estava na sala', styles: {} }],
    children: [],
  },
])

function seed() {
  const result = seedUpdateFromContent(sample)

  if (result.status !== 'ok') {
    throw new Error('seed unexpectedly unreadable')
  }

  return result.update
}

async function freePort() {
  const probe = createServer()

  await new Promise<void>((done) => probe.listen(0, '127.0.0.1', done))

  const port = (probe.address() as AddressInfo).port

  await new Promise((done) => probe.close(done))

  return port
}

async function waitFor(
  check: () => boolean,
  label: string,
  timeoutMs = 5_000,
) {
  const started = Date.now()

  while (!check()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error(`timed out waiting for ${label}`)
    }

    await new Promise((done) => setTimeout(done, 50))
  }
}

function readJson(request: import('node:http').IncomingMessage) {
  return new Promise<Record<string, unknown>>((done) => {
    const chunks: Array<Buffer> = []

    request.on('data', (chunk: Buffer) => chunks.push(chunk))
    request.on('end', () =>
      done(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')),
    )
  })
}

describe('realtime server rooms over HTTP', () => {
  const persisted: Array<{ state: string; authorId: unknown }> = []
  let app: Server
  let child: ChildProcess
  let port: number
  let provider: WebsocketProvider
  const doc = new Y.Doc({ gc: true })

  doc.getXmlFragment(realtimeFragmentName)

  beforeAll(async () => {
    app = createServer(async (request, response) => {
      const body = await readJson(request)
      const path = new URL(request.url ?? '/', 'http://localhost').pathname

      response.setHeader('content-type', 'application/json')

      if (path === '/api/realtime/authz') {
        response.end(JSON.stringify({ canWrite: true, user: { id: 'pessoa' } }))

        return
      }

      if (path === '/api/realtime/seed') {
        response.end(
          JSON.stringify({
            status: 'ok',
            identity: 'identidade-1',
            update: Buffer.from(seed()).toString('base64'),
          }),
        )

        return
      }

      if (path === '/api/realtime/persist') {
        persisted.push({
          state: body.state as string,
          authorId: body.authorId,
        })
        response.end(JSON.stringify({ ok: true, written: true }))

        return
      }

      response.writeHead(404).end('{}')
    })

    await new Promise<void>((done) => app.listen(0, '127.0.0.1', done))

    const appPort = (app.address() as AddressInfo).port

    port = await freePort()
    child = spawn(process.execPath, [resolve(projectRoot, 'scripts/dev-realtime.mjs')], {
      cwd: projectRoot,
      env: {
        ...process.env,
        LEAF_REALTIME: 'on',
        LEAF_REALTIME_HOST: '127.0.0.1',
        LEAF_REALTIME_PORT: String(port),
        LEAF_APP_URL: `http://127.0.0.1:${appPort}`,
        LEAF_REALTIME_SECRET: secret,
        LEAF_REALTIME_PERSIST_MS: '100',
        LEAF_REALTIME_IDLE_MS: '60000',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let output = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8')
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8')
    })

    await waitFor(() => output.includes('collaboration server on port'), 'the realtime server')

    provider = new WebsocketProvider(`ws://127.0.0.1:${port}`, 'doc:abc', doc)

    await waitFor(() => provider.synced, 'the client to sync')
  })

  afterAll(async () => {
    provider?.destroy()
    doc.destroy()
    child?.kill('SIGTERM')
    await new Promise((done) => app?.close(done))
  })

  function url(path: string) {
    return `http://127.0.0.1:${port}${path}`
  }

  it('answers nothing without the secret', async () => {
    const response = await fetch(url('/rooms/doc%3Aabc'))

    expect(response.status).toBe(404)
  })

  it('tells the app there is no room for a page nobody opened', async () => {
    const response = await fetch(url('/rooms/doc%3Aoutra'), {
      headers: { [realtimeSecretHeader]: secret },
    })

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ status: 'no-room' })
  })

  it('hands the app the live state of an open room', async () => {
    const response = await fetch(url('/rooms/doc%3Aabc'), {
      headers: { [realtimeSecretHeader]: secret },
    })

    expect(response.status).toBe(200)

    const payload = (await response.json()) as { state: string; connections: number }
    const text = contentFromRealtimeState(
      new Uint8Array(Buffer.from(payload.state, 'base64')),
    )

    expect(payload.connections).toBe(1)
    expect(text).toContain('Texto que já estava na sala')
  })

  it('applies an update from the app, shows it to the people connected and saves it', async () => {
    const stateResponse = await fetch(url('/rooms/doc%3Aabc'), {
      headers: { [realtimeSecretHeader]: secret },
    })
    const { state } = (await stateResponse.json()) as { state: string }
    const delta = liveRoomDelta(
      new Uint8Array(Buffer.from(state, 'base64')),
      [{ type: 'paragraph', content: [{ type: 'text', text: 'Vinda do MCP', styles: {} }] }],
      'append',
    )

    const response = await fetch(url('/rooms/doc%3Aabc/update'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [realtimeSecretHeader]: secret,
      },
      body: JSON.stringify({
        update: Buffer.from(delta).toString('base64'),
        authorId: 'pessoa-mcp',
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', applied: true })

    await waitFor(
      () => doc.getXmlFragment(realtimeFragmentName).toString().includes('Vinda do MCP'),
      'the connected client to receive the update',
    )
    await waitFor(
      () =>
        persisted.some((entry) =>
          (contentFromRealtimeState(new Uint8Array(Buffer.from(entry.state, 'base64'))) ?? '').includes(
            'Vinda do MCP',
          ),
        ),
      'the room to save the update',
    )

    expect(persisted.at(-1)?.authorId).toBe('pessoa-mcp')
  })

  it('refuses an update it cannot read', async () => {
    const response = await fetch(url('/rooms/doc%3Aabc/update'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [realtimeSecretHeader]: secret,
      },
      body: JSON.stringify({ update: '' }),
    })

    expect(response.status).toBe(400)
  })
})
