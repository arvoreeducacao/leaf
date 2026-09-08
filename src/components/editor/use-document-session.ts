'use client'

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
  realtimeFragmentName,
  realtimeRoomName,
  realtimeSyncTimeoutMs,
} from '@/lib/realtime'
import { avatarUrlFor } from '@/lib/avatar'
import { peersFromAwareness, realtimeColorFor } from '@/lib/realtime-user'

import { publishPresence, resetPresence } from './presence-bridge'
import { onRealtimeReconnectRequest } from './status-bridge'
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

type Options = Readonly<{
  realtimeEnabled: boolean
  documentId: string
  url: string | null
  port: number
  user: Readonly<{ id: string; name: string; image: string | null }>
  anonymousName: string
  fallbackContent: string | null
  fallbackUpdatedAt: number | null
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
}: Options) {
  const [phase, setPhase] = useState<SessionPhase>('loading')
  const [session, setSession] = useState<DocumentSession | null>(null)
  const [connection, setConnection] = useState<SessionConnection>(
    realtimeEnabled ? 'reconnecting' : 'solo',
  )
  const [seed, setSeed] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [localOnly, setLocalOnly] = useState(false)
  const contentRef = useRef(fallbackContent)
  const heldSinceRef = useRef(fallbackUpdatedAt)

  contentRef.current = fallbackContent
  heldSinceRef.current = fallbackUpdatedAt

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
      window.clearTimeout(syncTimeout)
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
      setSession({
        fragment: doc.getXmlFragment(realtimeFragmentName),
        user: localUser,
        provider: withProvider,
      })
      setPhase('ready')
    }

    function connectRealtime(snapshot: ServerSnapshot | null) {
      const socket = new WebsocketProvider(
        resolveRealtimeUrl(url, port, window.location),
        room,
        doc,
      )

      provider = socket
      socket.awareness.setLocalStateField('user', localUser)

      let opened = false
      let online = false

      syncTimeout = window.setTimeout(() => {
        if (opened || disposed) {
          return
        }

        opened = true
        void startSolo(snapshot, socket)
      }, realtimeSyncTimeoutMs)

      socket.on('sync', (isSynced: boolean) => {
        if (!isSynced || disposed) {
          return
        }

        markLive(documentId)
        void dropQueuedDocument(store, documentId)
        void writeLocalDocumentMeta(store, documentId, {
          identity: snapshot?.identity ?? null,
          serverUpdatedAt: snapshot?.updatedAt ?? null,
        })

        window.clearTimeout(syncTimeout)
        setConnection('connected')

        if (!opened) {
          opened = true
          openLocally(socket)
        }

        publishPeers(true)
      })

      socket.on('status', ({ status }: { status: string }) => {
        online = status === 'connected'

        if (!online) {
          unmarkLive(documentId)

          if (opened) {
            setConnection(navigator.onLine ? 'reconnecting' : 'offline')
          }
        }

        publishPeers(online)
      })

      socket.on('closed', () => {
        if (disposed) {
          return
        }

        unmarkLive(documentId)
        setConnection('lost')
        publishPeers(false)
      })

      stopReconnectRequests = onRealtimeReconnectRequest(() => {
        if (disposed || socket.shouldConnect) {
          return
        }

        setConnection('reconnecting')
        socket.connect()
      })

      socket.awareness.on('change', () => publishPeers(online))
    }

    async function startSolo(
      snapshot: ServerSnapshot | null,
      keepProvider: WebsocketProvider | null,
    ) {
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

      if (seeds && keepProvider) {
        keepProvider.destroy()
        provider = null
        unmarkLive(documentId)
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
      openLocally(seeds ? null : keepProvider)
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

    async function start() {
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
        await startSolo(snapshot, null)

        return
      }

      const decision = decideLocalStart({
        mode: 'realtime',
        hasLocalState: !isFragmentEmpty(fragment),
        hasPendingEdits: pending !== null,
        local,
        server: snapshot,
      })

      setConflict(decision.conflict)

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

  return { phase, session, connection, seed, conflict, localOnly }
}
