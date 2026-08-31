'use client'

import { useSyncExternalStore } from 'react'

export const pendingImportFlag = 'leaf:palette-import-pending'

const importEvent = 'leaf:palette-import'
const openEvent = 'leaf:palette-open'

let available = false

const listeners = new Set<() => void>()

export function setImportAvailability(value: boolean) {
  if (available === value) {
    return
  }

  available = value

  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function useImportAvailability(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => available,
    () => false,
  )
}

export function requestDocumentImport() {
  window.dispatchEvent(new Event(importEvent))
}

export function onDocumentImportRequest(handler: () => void) {
  window.addEventListener(importEvent, handler)

  return () => {
    window.removeEventListener(importEvent, handler)
  }
}

export function openCommandPalette() {
  window.dispatchEvent(new Event(openEvent))
}

export function onCommandPaletteOpen(handler: () => void) {
  window.addEventListener(openEvent, handler)

  return () => {
    window.removeEventListener(openEvent, handler)
  }
}
