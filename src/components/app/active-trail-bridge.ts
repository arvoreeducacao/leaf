'use client'

import { useSyncExternalStore } from 'react'

import type { TrailNode } from '@/lib/document-trail'

export type ActiveTrailScope =
  | Readonly<{ kind: 'private' }>
  | Readonly<{ kind: 'organization' }>
  | Readonly<{ kind: 'teamspace'; id: string }>
  | Readonly<{ kind: 'none' }>

export type ActiveTrail = Readonly<{
  documentId: string
  scope: ActiveTrailScope
  nodes: ReadonlyArray<TrailNode>
}>

let trail: ActiveTrail | null = null

const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) {
    listener()
  }
}

export function registerActiveTrail(next: ActiveTrail | null) {
  if (trail?.documentId === next?.documentId) {
    return
  }

  trail = next
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function useActiveTrail() {
  return useSyncExternalStore(
    subscribe,
    () => trail,
    () => null,
  )
}

export function scopeMatches(scope: ActiveTrailScope, section: string) {
  if (scope.kind === 'teamspace') {
    return section === `teamspace:${scope.id}`
  }

  return section === scope.kind
}
