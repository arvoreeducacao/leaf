'use client'

import { useSyncExternalStore } from 'react'

let slot: HTMLElement | null = null

const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

export function registerTopbarSlot(next: HTMLElement | null) {
  if (slot === next) {
    return
  }

  slot = next
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function useTopbarSlot() {
  return useSyncExternalStore(
    subscribe,
    () => slot,
    () => null,
  )
}
