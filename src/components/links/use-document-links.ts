'use client'

import { useCallback, useEffect, useState } from 'react'

import type { DocumentLinks, LinkedDocument } from '@/lib/document-link-graph'

export type DocumentLinksState =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'failed' }>
  | Readonly<{ status: 'ready'; links: DocumentLinks }>

const relations = new Set(['citation', 'subpage', 'parent'])
const kinds = new Set(['page', 'database', 'row', 'template'])
const countDelay = 1200

function readLinked(value: unknown): LinkedDocument | null {
  if (!value || typeof value !== 'object') {
    return null
  }

  const raw = value as Record<string, unknown>

  if (
    typeof raw.id !== 'string' ||
    typeof raw.title !== 'string' ||
    typeof raw.relation !== 'string' ||
    !relations.has(raw.relation)
  ) {
    return null
  }

  return {
    id: raw.id,
    title: raw.title,
    icon: typeof raw.icon === 'string' ? raw.icon : null,
    kind:
      typeof raw.kind === 'string' && kinds.has(raw.kind)
        ? (raw.kind as LinkedDocument['kind'])
        : 'page',
    relation: raw.relation as LinkedDocument['relation'],
    context: typeof raw.context === 'string' ? raw.context : '',
  }
}

function readList(value: unknown): Array<LinkedDocument> {
  return Array.isArray(value)
    ? value
        .map(readLinked)
        .filter((linked): linked is LinkedDocument => linked !== null)
    : []
}

async function fetchLinks(documentId: string): Promise<DocumentLinksState> {
  try {
    const response = await fetch(
      `/api/documents/${encodeURIComponent(documentId)}/links`,
      { cache: 'no-store' },
    )

    if (!response.ok) {
      return { status: 'failed' }
    }

    const payload = (await response.json()) as Record<string, unknown>

    return {
      status: 'ready',
      links: {
        incoming: readList(payload.incoming),
        outgoing: readList(payload.outgoing),
      },
    }
  } catch {
    return { status: 'failed' }
  }
}

export function linkCount(state: DocumentLinksState): number | null {
  return state.status === 'ready'
    ? state.links.incoming.length + state.links.outgoing.length
    : null
}

export function useDocumentLinks(documentId: string) {
  const [state, setState] = useState<DocumentLinksState>({ status: 'loading' })

  const reload = useCallback(async () => {
    setState((current) =>
      current.status === 'ready' ? current : { status: 'loading' },
    )
    setState(await fetchLinks(documentId))
  }, [documentId])

  useEffect(() => {
    let active = true

    setState({ status: 'loading' })

    const timer = window.setTimeout(() => {
      void fetchLinks(documentId).then((next) => {
        if (active) {
          setState(next)
        }
      })
    }, countDelay)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [documentId])

  return { state, reload }
}
