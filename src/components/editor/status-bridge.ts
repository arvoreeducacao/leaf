'use client'

import { useSyncExternalStore } from 'react'

import type { TextStats } from './text-stats'

export type SaveStatus =
  | 'idle'
  | 'pending'
  | 'saving'
  | 'saved'
  | 'error'
  | 'offline'

export type ConnectionStatus =
  | 'connected'
  | 'reconnecting'
  | 'lost'
  | 'offline'
  | 'solo'

export const readOnlyHintId = 'leaf-read-only-hint'

export type EditorStatus = Readonly<{
  ready: boolean
  readOnly: boolean
  save: SaveStatus
  stats: TextStats | null
  connection: ConnectionStatus
  conflict: boolean
}>

const idleStatus: EditorStatus = {
  ready: false,
  readOnly: false,
  save: 'idle',
  stats: null,
  connection: 'solo',
  conflict: false,
}

let status: EditorStatus = idleStatus

const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

function same(current: EditorStatus, next: EditorStatus) {
  return (
    current.ready === next.ready &&
    current.readOnly === next.readOnly &&
    current.save === next.save &&
    current.connection === next.connection &&
    current.conflict === next.conflict &&
    current.stats?.words === next.stats?.words &&
    current.stats?.characters === next.stats?.characters
  )
}

export function publishEditorStatus(next: EditorStatus) {
  if (same(status, next)) {
    return
  }

  status = next
  notify()
}

export function resetEditorStatus() {
  if (status === idleStatus) {
    return
  }

  status = idleStatus
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function useEditorStatus(): EditorStatus {
  return useSyncExternalStore(
    subscribe,
    () => status,
    () => idleStatus,
  )
}

const retryEvent = 'leaf:retry-save'

export function requestSaveRetry() {
  window.dispatchEvent(new Event(retryEvent))
}

export function onSaveRetryRequest(handler: () => void) {
  window.addEventListener(retryEvent, handler)

  return () => {
    window.removeEventListener(retryEvent, handler)
  }
}

const reconnectEvent = 'leaf:reconnect-realtime'

export function requestRealtimeReconnect() {
  window.dispatchEvent(new Event(reconnectEvent))
}

export function onRealtimeReconnectRequest(handler: () => void) {
  window.addEventListener(reconnectEvent, handler)

  return () => {
    window.removeEventListener(reconnectEvent, handler)
  }
}
