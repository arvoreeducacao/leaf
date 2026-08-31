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
const pingIntervalMs = 25_000

const flag = (process.env.LEAF_REALTIME ?? '').trim().toLowerCase()
const enabled =
  flag.length === 0
    ? process.env.NODE_ENV !== 'production'
    : flag === '1' || flag === 'true' || flag === 'on'

if (!enabled) {
  console.log('[realtime] LEAF_REALTIME desligado, servidor não vai subir')
  process.exit(0)
}

const seedOrigin = Symbol('leaf-seed')
const rooms = new Map()

function log(...args) {
  console.log('[realtime]', ...args)
}

function documentIdFromPath(pathname) {
  const room = decodeURIComponent(pathname.replace(/^\/+/, ''))

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
  try {
    const response = await callApp('/api/realtime/authz', { documentId }, cookie)

    if (!response.ok) {
      return null
    }

    const payload = await response.json()

    return {
      canWrite: payload.canWrite === true,
      userId: typeof payload.user?.id === 'string' ? payload.user.id : null,
    }
  } catch (error) {
    log('falha ao autorizar', documentId, error.message)

    return null
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

async function persistRoom(room) {
  if (!room.dirty) {
    return
  }

  room.dirty = false

  const state = Buffer.from(Y.encodeStateAsUpdate(room.doc)).toString('base64')

  try {
    const response = await callApp('/api/realtime/persist', {
      documentId: room.documentId,
      state,
      authorId: room.lastAuthorId,
    })

    if (!response.ok) {
      room.dirty = true
      log('falha ao salvar', room.documentId, response.status)
    }
  } catch (error) {
    room.dirty = true
    log('falha ao salvar', room.documentId, error.message)
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

    rooms.delete(room.documentId)
    room.awareness.destroy()
    room.doc.destroy()
    log('sala encerrada', room.documentId)
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
    lastAuthorId: null,
    persistTimer: null,
    idleTimer: null,
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

  log('sala aberta', documentId)

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
      log('mensagem inválida', room.documentId, error.message)
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

const server = createServer((request, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' })
  response.end('leaf realtime')
})

const wss = new WebSocketServer({ noServer: true })

const closeReasons = {
  [closeNotFound]: 'documento não encontrado',
  [closeForbidden]: 'sem acesso',
  [closeUnreadable]: 'conteúdo ilegível',
  [closeUnavailable]: 'indisponível',
}

async function admit(request) {
  const documentId = documentIdFromPath(
    new URL(request.url ?? '/', 'http://localhost').pathname,
  )

  if (!documentId) {
    return { closeCode: closeNotFound }
  }

  const access = await authorize(documentId, request.headers.cookie)

  if (!access) {
    return { closeCode: closeForbidden }
  }

  let result

  try {
    result = await getRoom(documentId)
  } catch (error) {
    log('falha ao abrir sala', documentId, error.message)

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
      connection.close(decision.closeCode, closeReasons[decision.closeCode])

      return
    }

    setupConnection(connection, decision.room, decision.access)
  })
})

server.listen(port, '127.0.0.1', () => {
  log(`servidor de colaboração em ws://127.0.0.1:${port} (app ${appUrl})`)
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
