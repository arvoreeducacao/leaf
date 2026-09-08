import { createServer } from 'node:http'

import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import { WebSocketServer } from 'ws'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as syncProtocol from 'y-protocols/sync'
import * as Y from 'yjs'

const messageSync = 0
const messageAwareness = 1
const messageQueryAwareness = 3

const closeForbidden = 4403
const closeNotFound = 4404
const closeUnreadable = 4409
const closeUnavailable = 4500

const roomPrefix = 'doc:'
const documentIdPattern = /^[A-Za-z0-9_-]{1,64}$/

const port = Number(process.env.LEAF_REALTIME_PORT ?? 1234)
const appUrl = process.env.LEAF_APP_URL ?? 'http://127.0.0.1:3000'
const secret = process.env.LEAF_REALTIME_SECRET ?? 'leaf-dev-realtime'
const persistIntervalMs = Number(process.env.LEAF_REALTIME_PERSIST_MS ?? 3_000)
const idleRoomMs = Number(process.env.LEAF_REALTIME_IDLE_MS ?? 5_000)
const persistAttempts = 3
const persistRetryMs = 1_000
const pingIntervalMs = 25_000

const flag = (process.env.LEAF_REALTIME ?? '').trim().toLowerCase()
const enabled =
  flag.length === 0
    ? process.env.NODE_ENV !== 'production'
    : flag === '1' || flag === 'true' || flag === 'on'

if (!enabled) {
  console.log('[realtime] LEAF_REALTIME is off, the server will not start')
  process.exit(0)
}

const seedOrigin = Symbol('leaf-seed')
const appOrigin = Symbol('leaf-app')
const maxBodyBytes = 4_000_000
const rooms = new Map()

function log(...args) {
  console.log('[realtime]', ...args)
}

function documentIdFromPath(pathname) {
  const segments = pathname.split('/').filter((segment) => segment.length > 0)
  const last = segments.at(-1)

  if (!last) {
    return null
  }

  let room

  try {
    room = decodeURIComponent(last)
  } catch {
    return null
  }

  if (!room.startsWith(roomPrefix)) {
    return null
  }

  const documentId = room.slice(roomPrefix.length)

  return documentIdPattern.test(documentId) ? documentId : null
}

async function callApp(path, body, cookie) {
  const headers = {
    'content-type': 'application/json',
    'x-leaf-realtime-secret': secret,
  }

  if (cookie) {
    headers.cookie = cookie
  }

  const response = await fetch(`${appUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  return response
}

async function authorize(documentId, cookie) {
  let response

  try {
    response = await callApp('/api/realtime/authz', { documentId }, cookie)
  } catch (error) {
    log('could not reach the app to authorize', documentId, error.message)

    return { status: 'unavailable' }
  }

  if (response.status === 401 || response.status === 403) {
    return { status: 'denied' }
  }

  if (!response.ok) {
    log('authorize answered', response.status, 'for', documentId)

    return { status: 'unavailable' }
  }

  try {
    const payload = await response.json()

    return {
      status: 'ok',
      canWrite: payload.canWrite === true,
      userId: typeof payload.user?.id === 'string' ? payload.user.id : null,
    }
  } catch (error) {
    log('authorize sent something unreadable for', documentId, error.message)

    return { status: 'unavailable' }
  }
}

async function loadSeed(documentId) {
  const response = await callApp('/api/realtime/seed', { documentId })

  if (response.status === 404) {
    return { status: 'not-found' }
  }

  if (!response.ok) {
    return { status: 'unavailable' }
  }

  const payload = await response.json()

  if (payload.status !== 'ok' || typeof payload.update !== 'string') {
    return { status: 'unreadable' }
  }

  return {
    status: 'ok',
    update: new Uint8Array(Buffer.from(payload.update, 'base64')),
  }
}

function send(connection, message) {
  if (connection.readyState !== connection.OPEN) {
    return
  }

  try {
    connection.send(message)
  } catch {
    connection.close()
  }
}

function broadcast(room, message, except) {
  for (const connection of room.connections.keys()) {
    if (connection !== except) {
      send(connection, message)
    }
  }
}

function encodeSyncUpdate(update) {
  const encoder = encoding.createEncoder()

  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeUpdate(encoder, update)

  return encoding.toUint8Array(encoder)
}

function encodeAwareness(awareness, clients) {
  const encoder = encoding.createEncoder()

  encoding.writeVarUint(encoder, messageAwareness)
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, clients),
  )

  return encoding.toUint8Array(encoder)
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function persistOnce(room) {
  const state = Buffer.from(Y.encodeStateAsUpdate(room.doc)).toString('base64')

  try {
    const response = await callApp('/api/realtime/persist', {
      documentId: room.documentId,
      state,
      authorId: room.lastAuthorId,
    })

    if (response.ok) {
      return true
    }

    log('failed to save', room.documentId, response.status)

    return false
  } catch (error) {
    log('failed to save', room.documentId, error.message)

    return false
  }
}

async function persistRoom(room, attempts = persistAttempts) {
  if (!room.dirty) {
    return
  }

  if (room.persisting) {
    schedulePersist(room)

    return
  }

  room.persisting = true
  room.dirty = false

  try {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (await persistOnce(room)) {
        return
      }

      if (attempt < attempts) {
        await wait(persistRetryMs)
      }
    }

    room.dirty = true
  } finally {
    room.persisting = false
  }
}

function schedulePersist(room) {
  if (room.persistTimer) {
    return
  }

  room.persistTimer = setTimeout(() => {
    room.persistTimer = null
    void persistRoom(room)
  }, persistIntervalMs)
}

function scheduleRoomShutdown(room) {
  if (room.idleTimer) {
    clearTimeout(room.idleTimer)
  }

  room.idleTimer = setTimeout(async () => {
    room.idleTimer = null

    if (room.connections.size > 0) {
      return
    }

    if (room.persistTimer) {
      clearTimeout(room.persistTimer)
      room.persistTimer = null
    }

    await persistRoom(room)

    if (room.connections.size > 0) {
      return
    }

    if (room.dirty && room.shutdownAttempts < 3) {
      room.shutdownAttempts += 1
      scheduleRoomShutdown(room)

      return
    }

    if (room.dirty) {
      log('giving up on saving', room.documentId)
    }

    rooms.delete(room.documentId)
    room.awareness.destroy()
    room.doc.destroy()
    log('room closed', room.documentId)
  }, idleRoomMs)
}

async function createRoom(documentId) {
  const seed = await loadSeed(documentId)

  if (seed.status !== 'ok') {
    return { status: seed.status }
  }

  const doc = new Y.Doc({ gc: true })

  Y.applyUpdate(doc, seed.update, seedOrigin)

  const awareness = new awarenessProtocol.Awareness(doc)

  awareness.setLocalState(null)

  const room = {
    documentId,
    doc,
    awareness,
    connections: new Map(),
    dirty: false,
    persisting: false,
    lastAuthorId: null,
    persistTimer: null,
    idleTimer: null,
    shutdownAttempts: 0,
  }

  doc.on('update', (update, origin) => {
    broadcast(room, encodeSyncUpdate(update), origin)

    if (origin === seedOrigin) {
      return
    }

    const entry = room.connections.get(origin)

    if (entry?.userId) {
      room.lastAuthorId = entry.userId
    }

    room.dirty = true
    schedulePersist(room)
  })

  awareness.on('update', ({ added, updated, removed }, origin) => {
    const changed = added.concat(updated, removed)
    const entry = room.connections.get(origin)

    if (entry) {
      for (const client of added) {
        entry.clients.add(client)
      }

      for (const client of removed) {
        entry.clients.delete(client)
      }
    }

    broadcast(room, encodeAwareness(awareness, changed))
  })

  log('room opened', documentId)

  return { status: 'ok', room }
}

function getRoom(documentId) {
  const existing = rooms.get(documentId)

  if (existing) {
    return existing
  }

  const pending = createRoom(documentId).then((result) => {
    if (result.status !== 'ok') {
      rooms.delete(documentId)
    }

    return result
  })

  rooms.set(documentId, pending)

  return pending
}

function handleMessage(room, connection, entry, data) {
  const decoder = decoding.createDecoder(new Uint8Array(data))
  const encoder = encoding.createEncoder()
  const messageType = decoding.readVarUint(decoder)

  if (messageType === messageSync) {
    encoding.writeVarUint(encoder, messageSync)

    if (entry.canWrite) {
      syncProtocol.readSyncMessage(decoder, encoder, room.doc, connection)
    } else {
      const syncType = decoding.readVarUint(decoder)

      if (syncType === syncProtocol.messageYjsSyncStep1) {
        syncProtocol.readSyncStep1(decoder, encoder, room.doc)
      }
    }

    if (encoding.length(encoder) > 1) {
      send(connection, encoding.toUint8Array(encoder))
    }

    return
  }

  if (messageType === messageAwareness) {
    awarenessProtocol.applyAwarenessUpdate(
      room.awareness,
      decoding.readVarUint8Array(decoder),
      connection,
    )

    return
  }

  if (messageType === messageQueryAwareness) {
    send(
      connection,
      encodeAwareness(
        room.awareness,
        Array.from(room.awareness.getStates().keys()),
      ),
    )
  }
}

function setupConnection(connection, room, access) {
  const entry = {
    canWrite: access.canWrite,
    userId: access.userId,
    clients: new Set(),
    alive: true,
  }

  room.connections.set(connection, entry)

  if (room.idleTimer) {
    clearTimeout(room.idleTimer)
    room.idleTimer = null
  }

  room.shutdownAttempts = 0
  connection.binaryType = 'arraybuffer'

  const encoder = encoding.createEncoder()

  encoding.writeVarUint(encoder, messageSync)
  syncProtocol.writeSyncStep1(encoder, room.doc)
  send(connection, encoding.toUint8Array(encoder))

  const states = room.awareness.getStates()

  if (states.size > 0) {
    send(connection, encodeAwareness(room.awareness, Array.from(states.keys())))
  }

  connection.on('message', (data) => {
    try {
      handleMessage(room, connection, entry, data)
    } catch (error) {
      log('invalid message', room.documentId, error.message)
    }
  })

  connection.on('pong', () => {
    entry.alive = true
  })

  const ping = setInterval(() => {
    if (!entry.alive) {
      connection.terminate()

      return
    }

    entry.alive = false

    try {
      connection.ping()
    } catch {
      connection.terminate()
    }
  }, pingIntervalMs)

  connection.on('close', () => {
    clearInterval(ping)
    room.connections.delete(connection)
    awarenessProtocol.removeAwarenessStates(
      room.awareness,
      Array.from(entry.clients),
      null,
    )

    if (room.connections.size === 0) {
      scheduleRoomShutdown(room)
    }
  })
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0

    request.on('data', (chunk) => {
      size += chunk.length

      if (size > maxBodyBytes) {
        reject(new Error('body too large'))
        request.destroy()

        return
      }

      chunks.push(chunk)
    })
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function answer(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(payload))
}

async function liveRoom(documentId) {
  const pending = rooms.get(documentId)

  if (!pending) {
    return null
  }

  const result = await pending

  return result.status === 'ok' ? result.room : null
}

function roomRoute(pathname) {
  const match = /^\/rooms\/([^/]+)(\/update)?$/.exec(pathname)

  if (!match) {
    return null
  }

  const documentId = documentIdFromPath(`/${match[1]}`)

  return documentId ? { documentId, update: match[2] === '/update' } : null
}

async function applyAppUpdate(room, request, response) {
  let body

  try {
    body = JSON.parse((await readBody(request)).toString('utf8'))
  } catch {
    answer(response, 400, { status: 'bad-request' })

    return
  }

  const update =
    typeof body?.update === 'string' && body.update.length > 0
      ? new Uint8Array(Buffer.from(body.update, 'base64'))
      : null

  if (!update || update.byteLength === 0) {
    answer(response, 400, { status: 'bad-request' })

    return
  }

  if (typeof body.authorId === 'string' && body.authorId.length > 0) {
    room.lastAuthorId = body.authorId
  }

  try {
    Y.applyUpdate(room.doc, update, appOrigin)
  } catch (error) {
    log('rejected an update from the app', room.documentId, error.message)
    answer(response, 422, { status: 'unreadable' })

    return
  }

  log('applied an update from the app', room.documentId)
  answer(response, 200, {
    status: 'ok',
    applied: true,
    connections: room.connections.size,
  })
}

async function handleHttp(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const route = roomRoute(url.pathname)

  if (!route) {
    response.writeHead(200, { 'content-type': 'text/plain' })
    response.end('leaf realtime')

    return
  }

  if (request.headers['x-leaf-realtime-secret'] !== secret) {
    answer(response, 404, { status: 'not-found' })

    return
  }

  const room = await liveRoom(route.documentId)

  if (!room) {
    answer(response, 404, { status: 'no-room' })

    return
  }

  if (!route.update && request.method === 'GET') {
    answer(response, 200, {
      status: 'ok',
      state: Buffer.from(Y.encodeStateAsUpdate(room.doc)).toString('base64'),
      connections: room.connections.size,
    })

    return
  }

  if (route.update && request.method === 'POST') {
    await applyAppUpdate(room, request, response)

    return
  }

  answer(response, 405, { status: 'method-not-allowed' })
}

const server = createServer((request, response) => {
  handleHttp(request, response).catch((error) => {
    log('http request failed', error.message)

    if (!response.headersSent) {
      answer(response, 500, { status: 'error' })
    }
  })
})

const wss = new WebSocketServer({ noServer: true })

const closeReasons = {
  [closeNotFound]: 'document not found',
  [closeForbidden]: 'no access',
  [closeUnreadable]: 'unreadable content',
  [closeUnavailable]: 'unavailable',
}

async function admit(request) {
  const documentId = documentIdFromPath(
    new URL(request.url ?? '/', 'http://localhost').pathname,
  )

  if (!documentId) {
    return { closeCode: closeNotFound }
  }

  const access = await authorize(documentId, request.headers.cookie)

  if (access.status === 'unavailable') {
    return { closeCode: closeUnavailable }
  }

  if (access.status === 'denied') {
    return { closeCode: closeForbidden }
  }

  let result

  try {
    result = await getRoom(documentId)
  } catch (error) {
    log('failed to open room', documentId, error.message)

    return { closeCode: closeUnavailable }
  }

  if (result.status === 'not-found') {
    return { closeCode: closeNotFound }
  }

  if (result.status === 'unreadable') {
    return { closeCode: closeUnreadable }
  }

  if (result.status !== 'ok') {
    return { closeCode: closeUnavailable }
  }

  return { room: result.room, access }
}

server.on('upgrade', async (request, socket, head) => {
  const decision = await admit(request)

  if (socket.destroyed) {
    if (decision.room && decision.room.connections.size === 0) {
      scheduleRoomShutdown(decision.room)
    }

    return
  }

  wss.handleUpgrade(request, socket, head, (connection) => {
    if (decision.closeCode) {
      log(
        'refused',
        decision.closeCode,
        closeReasons[decision.closeCode],
        request.url,
      )
      connection.close(decision.closeCode, closeReasons[decision.closeCode])

      return
    }

    setupConnection(connection, decision.room, decision.access)
  })
})

server.listen(port, process.env.LEAF_REALTIME_HOST, () => {
  log(`collaboration server on port ${port} (app ${appUrl})`)
})

async function shutdown() {
  for (const value of rooms.values()) {
    const result = await value

    if (result.status === 'ok') {
      await persistRoom(result.room)
    }
  }

  process.exit(0)
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void shutdown()
  })
}
