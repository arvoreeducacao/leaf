'use client'

import { useEffect, useState } from 'react'
import { WebsocketProvider } from 'y-websocket'
import * as Y from 'yjs'

import {
  realtimeFragmentName,
  realtimeRoomName,
  realtimeSyncTimeoutMs,
} from '@/lib/realtime'
import { peersFromAwareness, realtimeColorFor } from '@/lib/realtime-user'

import { publishPresence, resetPresence } from './presence-bridge'

export type RealtimeUser = Readonly<{
  id: string
  name: string
  color: string
}>

export type RealtimeSession = Readonly<{
  provider: WebsocketProvider
  fragment: Y.XmlFragment
  user: RealtimeUser
}>

export type RealtimePhase = 'connecting' | 'ready' | 'offline'

type Options = Readonly<{
  enabled: boolean
  documentId: string
  url: string | null
  port: number
  user: Readonly<{ id: string; name: string }>
  anonymousName: string
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

export function useRealtimeSession({
  enabled,
  documentId,
  url,
  port,
  user,
  anonymousName,
}: Options) {
  const [phase, setPhase] = useState<RealtimePhase>(
    enabled ? 'connecting' : 'offline',
  )
  const [session, setSession] = useState<RealtimeSession | null>(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    if (!enabled) {
      return
    }

    const doc = new Y.Doc({ gc: true })
    const localUser: RealtimeUser = {
      id: user.id,
      name: user.name,
      color: realtimeColorFor(user.id, 'light'),
    }

    const provider = new WebsocketProvider(
      resolveRealtimeUrl(url, port, window.location),
      realtimeRoomName(documentId),
      doc,
    )

    provider.awareness.setLocalStateField('user', localUser)

    let settled = false
    let disposed = false
    let online = false

    function publish() {
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

    function dispose() {
      if (disposed) {
        return
      }

      disposed = true
      window.clearTimeout(timeout)
      provider.awareness.off('change', publish)
      provider.destroy()
      doc.destroy()
      resetPresence()
    }

    function giveUp() {
      if (settled) {
        return
      }

      settled = true
      dispose()
      setConnected(false)
      setPhase('offline')
    }

    const timeout = window.setTimeout(giveUp, realtimeSyncTimeoutMs)

    provider.on('sync', (isSynced) => {
      if (!isSynced || settled) {
        return
      }

      settled = true
      window.clearTimeout(timeout)
      setSession({
        provider,
        fragment: doc.getXmlFragment(realtimeFragmentName),
        user: localUser,
      })
      setPhase('ready')
      publish()
    })

    provider.on('status', ({ status }) => {
      online = status === 'connected'
      setConnected(online)
      publish()
    })

    provider.on('closed', giveUp)
    provider.awareness.on('change', publish)

    return dispose
  }, [anonymousName, documentId, enabled, port, url, user.id, user.name])

  return { phase, session, connected }
}
