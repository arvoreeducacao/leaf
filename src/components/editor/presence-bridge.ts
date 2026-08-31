'use client'

import { useSyncExternalStore } from 'react'

import type { RealtimePeer } from '@/lib/realtime-user'

export type PresenceState = Readonly<{
  active: boolean
  connected: boolean
  peers: ReadonlyArray<RealtimePeer>
}>

const emptyPresence: PresenceState = {
  active: false,
  connected: false,
  peers: [],
}

let presence: PresenceState = emptyPresence

const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

function samePeers(
  current: ReadonlyArray<RealtimePeer>,
  next: ReadonlyArray<RealtimePeer>,
) {
  if (current.length !== next.length) {
    return false
  }

  return current.every((peer, index) => {
    const other = next[index]

    return peer.clientId === other.clientId && peer.name === other.name
  })
}

export function publishPresence(next: PresenceState) {
  if (
    presence.active === next.active &&
    presence.connected === next.connected &&
    samePeers(presence.peers, next.peers)
  ) {
    return
  }

  presence = next
  notify()
}

export function resetPresence() {
  if (presence === emptyPresence) {
    return
  }

  presence = emptyPresence
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function usePresence(): PresenceState {
  return useSyncExternalStore(
    subscribe,
    () => presence,
    () => emptyPresence,
  )
}
