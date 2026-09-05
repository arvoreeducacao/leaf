'use client'

import { useEffect, useState } from 'react'

import type { DocumentPreview } from '@/lib/document-preview'

export type DocumentPreviewState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'missing' }>
  | Readonly<{ status: 'ready'; preview: DocumentPreview }>

type Entry = Readonly<{ at: number; state: DocumentPreviewState }>

const freshness = 60_000
const kinds = new Set(['page', 'database', 'row', 'template'])

const entries = new Map<string, Entry>()
const inFlight = new Map<string, Promise<DocumentPreviewState>>()

const missing: DocumentPreviewState = { status: 'missing' }

function readPreview(id: string, payload: unknown): DocumentPreviewState {
  if (!payload || typeof payload !== 'object') {
    return missing
  }

  const raw = payload as Record<string, unknown>
  const trail = Array.isArray(raw.trail) ? raw.trail : []

  if (typeof raw.title !== 'string' || typeof raw.kind !== 'string') {
    return missing
  }

  return {
    status: 'ready',
    preview: {
      id,
      title: raw.title,
      icon: typeof raw.icon === 'string' ? raw.icon : null,
      kind: kinds.has(raw.kind)
        ? (raw.kind as DocumentPreview['kind'])
        : 'page',
      trail: trail.filter((crumb): crumb is string => typeof crumb === 'string'),
      excerpt: typeof raw.excerpt === 'string' ? raw.excerpt : '',
    },
  }
}

function fetchPreview(id: string): Promise<DocumentPreviewState> {
  const running = inFlight.get(id)

  if (running) {
    return running
  }

  const request = fetch(`/api/documents/${encodeURIComponent(id)}/preview`)
    .then((response) => (response.ok ? response.json() : null))
    .then((payload) => readPreview(id, payload))
    .catch(() => missing)
    .then((state) => {
      entries.set(id, { at: Date.now(), state })
      inFlight.delete(id)

      return state
    })

  inFlight.set(id, request)

  return request
}

function cached(id: string): DocumentPreviewState | null {
  const entry = entries.get(id)

  if (!entry || Date.now() - entry.at > freshness) {
    return null
  }

  return entry.state
}

export function forgetDocumentPreview(id: string) {
  entries.delete(id)
}

export function useDocumentPreview(id: string): DocumentPreviewState {
  const [state, setState] = useState<DocumentPreviewState>(
    () => cached(id) ?? { status: 'loading' },
  )

  useEffect(() => {
    const known = cached(id)

    if (known) {
      setState(known)

      return
    }

    let active = true

    setState({ status: 'loading' })
    fetchPreview(id).then((next) => {
      if (active) {
        setState(next)
      }
    })

    return () => {
      active = false
    }
  }, [id])

  return state
}
