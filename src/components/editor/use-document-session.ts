'use client'

import * as decoding from 'lib0/decoding'
import { useEffect, useRef, useState } from 'react'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

import {
  decideLocalStart,
  readLocalDocumentMeta,
  writeLocalDocumentMeta,
} from '@/lib/offline/local-document'
import type { ServerSnapshot } from '@/lib/offline/local-document'
import { dropQueuedDocument, readQueuedDocument } from '@/lib/offline/outbox'
import { offlineStore } from '@/lib/offline/store'
import {
  realtimeCloseCodes,
  realtimeConnectionFrom,
  readRealtimeSignal,
  realtimeFragmentName,
  realtimeRoomName,
  realtimeSignalMessage,
  realtimeSyncTimeoutMs,
} from '@/lib/realtime'
import { avatarUrlFor } from '@/lib/avatar'
import { peersFromAwareness, realtimeColorFor } from '@/lib/realtime-user'

import { publishPresence, resetPresence } from './presence-bridge'
import { publishDocumentSignal } from './signal-bridge'
import {
  onLocalCopyResetRequest,
  onRealtimeReconnectRequest,
} from './status-bridge'
import { markLive, unmarkLive } from '@/lib/offline/live-documents'

export type DocumentUser = Readonly<{
  id: string
  name: string
  image: string
  color: string
}>

export type DocumentSession = Readonly<{
  fragment: Y.XmlFragment
  user: DocumentUser
  provider: WebsocketProvider | null
}>

export type SessionPhase = 'loading' | 'ready' | 'unavailable'

export type SessionConnection =
  | 'connected'
  | 'reconnecting'
  | 'lost'
  | 'offline'
  | 'solo'

const snapshotTimeoutMs = 4_000
const offlineRetryMs = 5_000
const rejoinCooldownMs = 10_000
const trashedRetryMs = 30_000

type Options = Readonly<{
  realtimeEnabled: boolean
  documentId: string
  url: string | null
  port: number
  user: Readonly<{ id: string; name: string; image: string | null }>
  anonymousName: string
  fallbackContent: string | null
  fallbackUpdatedAt: number | null
  onAccessChange: () => void
}>

export function resolveRealtimeUrl(
  url: string | null,
  port: number,
  location: Readonly<{ protocol: string; hostname: string }>,
) {
  if (url && url.length > 0) {
    return url
  }

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'

  return `${protocol}//${location.hostname}:${port}`
}

export function snapshotUrl(documentId: string, since: number | null) {
  const path = `/api/documents/${documentId}/snapshot`

  return since === null ? path : `${path}?since=${since}`
}

export async function fetchServerSnapshot(
  documentId: string,
  since: number | null = null,
  timeoutMs = snapshotTimeoutMs,
): Promise<ServerSnapshot | null> {
  const abort = new AbortController()
  const timeout = setTimeout(() => abort.abort(), timeoutMs)

  try {
    const response = await fetch(snapshotUrl(documentId, since), {
      cache: 'no-store',
      signal: abort.signal,
    })

    if (!response.ok) {
      return null
    }

    const payload = (await response.json()) as ServerSnapshot

    return typeof payload.updatedAt === 'number' ? payload : null
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function isFragmentEmpty(fragment: Y.XmlFragment) {
  return fragment.length === 0
}

export function useDocumentSession({
  realtimeEnabled,
  documentId,
  url,
  port,
  user,
  anonymousName,
  fallbackContent,
  fallbackUpdatedAt,
  onAccessChange,
}: Options) {
  const [phase, setPhase] = useState<SessionPhase>('loading')
  const [session, setSession] = useState<DocumentSession | null>(null)
  const [connection, setConnection] = useState<SessionConnection>(
    realtimeEnabled ? 'reconnecting' : 'solo',
  )
  const [seed, setSeed] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [localOnly, setLocalOnly] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [trashed, setTrashed] = useState(false)
  const contentRef = useRef(fallbackContent)
  const heldSinceRef = useRef(fallbackUpdatedAt)
  const accessChangeRef = useRef(onAccessChange)

  contentRef.current = fallbackContent
  heldSinceRef.current = fallbackUpdatedAt
  accessChangeRef.current = onAccessChange

  useEffect(() => {
    const store = offlineStore()
    const room = realtimeRoomName(documentId)
    const localUser: DocumentUser = {
      id: user.id,
      name: user.name,
      image: avatarUrlFor(user.id, user.image),
      color: realtimeColorFor(user.id, 'light'),
    }

    let disposed = false
    let doc = new Y.Doc({ gc: true })
    let persistence = new IndexeddbPersistence(room, doc)
    let provider: WebsocketProvider | null = null
    let syncTimeout = 0
    let pendingRetry: (() => void) | null = null
    let retryTimer = 0
    let stopReconnectRequests = () => {}
    let stopLocalResets = () => {}
    let lastRejoinAt = 0
    let editedWhileAway = false
    let preview: Y.Doc | null = null
    let inTrash = false
    let trashedRetry = 0

    function runPendingRetry() {
      const retry = pendingRetry

      pendingRetry = null
      window.removeEventListener('online', runPendingRetry)
      window.clearTimeout(retryTimer)
      retry?.()
    }

    function dispose() {
      if (disposed) {
        return
      }

      disposed = true
      stopReconnectRequests()
      stopLocalResets()
      window.clearTimeout(syncTimeout)
      window.clearTimeout(trashedRetry)
      preview?.destroy()
      window.removeEventListener('online', runPendingRetry)
      window.clearTimeout(retryTimer)
      pendingRetry = null
      unmarkLive(documentId)

      if (provider) {
        provider.destroy()
      }

      void persistence.destroy()
      doc.destroy()
      resetPresence()
    }

    async function reset() {
      await persistence.clearData()
      doc.destroy()
      doc = new Y.Doc({ gc: true })
      persistence = new IndexeddbPersistence(room, doc)

      await persistence.whenSynced
    }

    function publishPeers(online: boolean) {
      if (!provider) {
        return
      }

      publishPresence({
        active: true,
        connected: online,
        peers: peersFromAwareness(
          provider.awareness.getStates(),
          doc.clientID,
          anonymousName,
        ),
      })
    }

    function openLocally(withProvider: WebsocketProvider | null) {
      if (preview) {
        preview.destroy()
        preview = null
        setSeed(null)
        setWaiting(false)
      }

      setSession({
        fragment: doc.getXmlFragment(realtimeFragmentName),
        user: localUser,
        provider: withProvider,
      })
      setPhase('ready')
    }

    function openPreview(content: string | null) {
      preview?.destroy()
      preview = new Y.Doc({ gc: true })
      setSeed(content)
      setWaiting(true)
      setSession({
        fragment: preview.getXmlFragment(realtimeFragmentName),
        user: localUser,
        provider: null,
      })
      setPhase('ready')
    }

    function openWhileConnecting(
      snapshot: ServerSnapshot | null,
      socket: WebsocketProvider,
    ) {
      if (isFragmentEmpty(doc.getXmlFragment(realtimeFragmentName))) {
        openPreview(snapshot?.content ?? contentRef.current)

        return
      }

      openLocally(socket)
    }

    function leaveTrash() {
      if (!inTrash) {
        return
      }

      inTrash = false
      window.clearTimeout(trashedRetry)
      setTrashed(false)
    }

    function enterTrash(socket: WebsocketProvider, identity: string | null) {
      inTrash = true
      setTrashed(true)
      window.clearTimeout(trashedRetry)
      trashedRetry = window.setTimeout(() => {
        if (!disposed && inTrash && !socket.shouldConnect) {
          void rejoinWhenRestored(socket, identity)
        }
      }, trashedRetryMs)
    }

    async function rejoinWhenRestored(
      socket: WebsocketProvider,
      identity: string | null,
    ) {
      window.clearTimeout(trashedRetry)

      const snapshot = await fetchServerSnapshot(
        documentId,
        heldSinceRef.current,
      )

      if (disposed || !inTrash || provider !== socket) {
        return
      }

      if (snapshot === null) {
        enterTrash(socket, identity)

        return
      }

      if (snapshot.identity !== identity) {
        void rejoin(socket, editedWhileAway)

        return
      }

      socket.connect()
    }

    function connectRealtime(snapshot: ServerSnapshot | null) {
      const identity = snapshot?.identity ?? null
      const socket = new WebsocketProvider(
        resolveRealtimeUrl(url, port, window.location),
        room,
        doc,
        {
          disableBc: true,
          ...(identity === null ? {} : { params: { identity } }),
        },
      )

      provider = socket
      socket.messageHandlers[realtimeSignalMessage] = (_encoder, decoder) => {
        const topic = readRealtimeSignal(decoding.readVarString(decoder))

        if (topic && !disposed) {
          publishDocumentSignal({ documentId, topic })
        }
      }
      socket.awareness.setLocalStateField('user', localUser)
      doc.on('update', (_update: Uint8Array, origin: unknown) => {
        if (origin !== socket && !(socket.wsconnected && socket.synced)) {
          editedWhileAway = true
        }
      })

      let opened = false
      let online = false

      function refreshConnection() {
        if (disposed || !opened) {
          return
        }

        const next = realtimeConnectionFrom({
          online: navigator.onLine,
          connected: socket.wsconnected,
          synced: socket.synced,
          stillTrying: socket.shouldConnect,
        })

        setConnection(next)
      }

      syncTimeout = window.setTimeout(() => {
        if (opened || disposed) {
          return
        }

        opened = true
        openWhileConnecting(snapshot, socket)
        refreshConnection()
      }, realtimeSyncTimeoutMs)

      socket.on('sync', (isSynced: boolean) => {
        if (!isSynced || disposed) {
          return
        }

        markLive(documentId)
        editedWhileAway = false
        void dropQueuedDocument(store, documentId)
        void writeLocalDocumentMeta(store, documentId, {
          identity: snapshot?.identity ?? null,
          serverUpdatedAt: snapshot?.updatedAt ?? null,
        })

        window.clearTimeout(syncTimeout)
        leaveTrash()

        if (!opened || preview) {
          opened = true
          openLocally(socket)
        }

        refreshConnection()
        publishPeers(true)
      })

      socket.on('status', ({ status }: { status: string }) => {
        online = status === 'connected'

        if (!online) {
          unmarkLive(documentId)
        }

        refreshConnection()
        publishPeers(online)
      })

      socket.on('connection-close', (event: CloseEvent | null) => {
        if (!disposed && event?.code === realtimeCloseCodes.accessChanged) {
          accessChangeRef.current()
        }
      })

      socket.on('closed', ({ code }: { code: number }) => {
        if (disposed) {
          return
        }

        if (
          code === realtimeCloseCodes.identityChanged &&
          Date.now() - lastRejoinAt > rejoinCooldownMs
        ) {
          lastRejoinAt = Date.now()
          void rejoin(socket, editedWhileAway)

          return
        }

        unmarkLive(documentId)

        if (
          code === realtimeCloseCodes.trashed ||
          (inTrash && code === realtimeCloseCodes.forbidden)
        ) {
          enterTrash(socket, identity)

          if (!opened) {
            opened = true
            window.clearTimeout(syncTimeout)
            openWhileConnecting(snapshot, socket)
          }
        } else if (code === realtimeCloseCodes.forbidden) {
          accessChangeRef.current()
        }

        refreshConnection()
        publishPeers(false)
      })

      stopReconnectRequests = onRealtimeReconnectRequest(() => {
        if (disposed || socket.wsconnected) {
          return
        }

        if (inTrash) {
          void rejoinWhenRestored(socket, identity)

          return
        }

        setConnection('reconnecting')

        if (socket.shouldConnect) {
          socket.disconnect()
        }

        socket.connect()
      })

      stopLocalResets = onLocalCopyResetRequest(() => {
        if (!disposed && provider === socket) {
          void rejoin(socket, false)
        }
      })

      socket.awareness.on('change', () => publishPeers(online))
    }

    async function rejoin(socket: WebsocketProvider, droppedEdits: boolean) {
      editedWhileAway = false
      stopReconnectRequests()
      stopLocalResets()
      window.clearTimeout(syncTimeout)
      leaveTrash()
      socket.destroy()
      provider = null
      unmarkLive(documentId)
      resetPresence()
      setSession(null)
      setPhase('loading')
      setConnection('reconnecting')

      await reset()

      if (disposed) {
        return
      }

      await start(droppedEdits)
    }

    async function startSolo(snapshot: ServerSnapshot | null) {
      if (disposed) {
        return
      }

      const fragment = doc.getXmlFragment(realtimeFragmentName)
      const pending = await readQueuedDocument(store, documentId)
      const local = await readLocalDocumentMeta(store, documentId)
      const soloDecision = decideLocalStart({
        mode: 'solo',
        hasLocalState: !isFragmentEmpty(fragment),
        hasPendingEdits: pending !== null,
        local,
        server: snapshot,
      })

      if (disposed) {
        return
      }

      setConflict(soloDecision.conflict)

      if (soloDecision.action === 'unavailable') {
        setConnection(navigator.onLine ? 'solo' : 'offline')
        setPhase('unavailable')

        return
      }

      const seeds =
        soloDecision.action === 'seed' ||
        soloDecision.action === 'reset-and-seed'

      if (soloDecision.action === 'reset-and-seed') {
        await reset()

        if (disposed) {
          return
        }
      }

      if (seeds) {
        setSeed(snapshot?.content ?? contentRef.current)
      }

      if (snapshot) {
        await writeLocalDocumentMeta(store, documentId, {
          identity: snapshot.identity,
          serverUpdatedAt: snapshot.updatedAt,
        })
      }

      if (disposed) {
        return
      }

      setConnection(
        snapshot === null && !navigator.onLine ? 'offline' : 'solo',
      )
      setLocalOnly(soloDecision.action === 'local-only')
      openLocally(null)
    }

    function whenOnlineAgain(retry: () => void) {
      if (disposed) {
        return
      }

      pendingRetry = retry
      window.addEventListener('online', runPendingRetry, { once: true })
      window.clearTimeout(retryTimer)
      retryTimer = window.setTimeout(runPendingRetry, offlineRetryMs)
    }

    async function reconnectAfterOffline() {
      if (disposed) {
        return
      }

      const snapshot = await fetchServerSnapshot(
        documentId,
        heldSinceRef.current,
      )

      if (disposed) {
        return
      }

      if (snapshot === null) {
        whenOnlineAgain(reconnectAfterOffline)

        return
      }

      const local = await readLocalDocumentMeta(store, documentId)

      if (disposed) {
        return
      }

      if (
        local?.identity != null &&
        snapshot.identity != null &&
        local.identity !== snapshot.identity
      ) {
        setConflict(true)

        return
      }

      setLocalOnly(false)
      connectRealtime(snapshot)
    }

    async function start(droppedEdits = false) {
      await persistence.whenSynced

      if (disposed) {
        return
      }

      const fragment = doc.getXmlFragment(realtimeFragmentName)
      const pending = await readQueuedDocument(store, documentId)
      const local = await readLocalDocumentMeta(store, documentId)
      const snapshot = navigator.onLine
        ? await fetchServerSnapshot(documentId, heldSinceRef.current)
        : null

      if (disposed) {
        return
      }

      if (!realtimeEnabled) {
        await startSolo(snapshot)

        return
      }

      const decision = decideLocalStart({
        mode: 'realtime',
        hasLocalState: !isFragmentEmpty(fragment),
        hasPendingEdits: pending !== null,
        local,
        server: snapshot,
      })

      setConflict(decision.conflict || droppedEdits)

      if (decision.action === 'reset-and-connect') {
        await reset()

        if (disposed) {
          return
        }
      }

      if (decision.action === 'local-only') {
        setConnection('offline')
        setLocalOnly(true)
        openLocally(null)
        whenOnlineAgain(reconnectAfterOffline)

        return
      }

      if (decision.action === 'unavailable') {
        setConnection('offline')
        setPhase('unavailable')
        whenOnlineAgain(() => void start())

        return
      }

      connectRealtime(snapshot)
    }

    void start()

    return dispose
  }, [anonymousName, documentId, port, realtimeEnabled, url, user.id, user.name])

  return {
    phase,
    session,
    connection,
    seed,
    conflict,
    localOnly,
    waiting,
    trashed,
  }
}
