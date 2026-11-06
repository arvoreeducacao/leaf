'use client'

import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { loadComments } from '@/lib/comment-actions'
import type { CommentsState } from '@/lib/comments-state'

type StoredComments = Readonly<{ documentId: string; state: CommentsState }>

let stored: StoredComments | null = null
let loadingFor: string | null = null
let reloadQueuedFor: string | null = null

const listeners = new Set<() => void>()

function emit() {
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

export function publishCommentsState(documentId: string, state: CommentsState) {
  stored = { documentId, state }
  emit()
}

export function useCommentsState(documentId: string): CommentsState | null {
  const current = useSyncExternalStore(
    subscribe,
    () => stored,
    () => null,
  )

  return current?.documentId === documentId ? current.state : null
}

function finishLoading(documentId: string) {
  if (loadingFor === documentId) {
    loadingFor = null
  }

  if (reloadQueuedFor === documentId) {
    reloadQueuedFor = null
    void reloadComments(documentId)
  }
}

export async function ensureCommentsLoaded(documentId: string) {
  if (stored?.documentId === documentId || loadingFor === documentId) {
    return
  }

  loadingFor = documentId

  try {
    const result = await loadComments(documentId)

    if (result.ok) {
      publishCommentsState(documentId, result.state)
    } else {
      toast.error(result.error)
    }
  } finally {
    finishLoading(documentId)
  }
}

export async function reloadComments(documentId: string) {
  if (loadingFor === documentId) {
    reloadQueuedFor = documentId

    return
  }

  loadingFor = documentId

  try {
    const result = await loadComments(documentId)

    if (result.ok && (stored === null || stored.documentId === documentId)) {
      publishCommentsState(documentId, result.state)
    }
  } catch {
    return
  } finally {
    finishLoading(documentId)
  }
}
