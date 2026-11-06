'use client'

import { useSyncExternalStore } from 'react'

type SlotStore = Readonly<{
  read: () => HTMLElement | null
  register: (next: HTMLElement | null) => void
  subscribe: (listener: () => void) => () => void
}>

function createSlotStore(): SlotStore {
  let slot: HTMLElement | null = null
  const listeners = new Set<() => void>()

  return {
    read: () => slot,
    register(next) {
      if (slot === next) {
        return
      }

      slot = next

      for (const listener of listeners) {
        listener()
      }
    },
    subscribe(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },
  }
}

const topbarSlot = createSlotStore()
const noticeSlot = createSlotStore()

function useSlot(store: SlotStore) {
  return useSyncExternalStore(store.subscribe, store.read, () => null)
}

export function registerTopbarSlot(next: HTMLElement | null) {
  topbarSlot.register(next)
}

export function useTopbarSlot() {
  return useSlot(topbarSlot)
}

export function registerNoticeSlot(next: HTMLElement | null) {
  noticeSlot.register(next)
}

export function useNoticeSlot() {
  return useSlot(noticeSlot)
}
