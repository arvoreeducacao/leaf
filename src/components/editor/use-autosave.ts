'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { updateDocumentContent } from '@/lib/document-actions'
import {
  dropQueuedDocument,
  queueDocumentContent,
  readQueuedDocument,
} from '@/lib/offline/outbox'
import { offlineStore } from '@/lib/offline/store'

import type { SaveStatus } from './status-bridge'

const DEBOUNCE_MS = 1000
const RETRY_MS = 5000

export function useAutosave(documentId: string, enabled: boolean) {
  const [status, setStatus] = useState<SaveStatus>('idle')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingRef = useRef<string | null>(null)
  const savedRef = useRef<string | null>(null)
  const inFlightRef = useRef(false)

  const flush = useCallback(async () => {
    if (!enabled || inFlightRef.current) {
      return
    }

    const next = pendingRef.current

    if (next === null || next === savedRef.current) {
      return
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    const store = offlineStore()
    const queuedAt = Date.now()

    inFlightRef.current = true

    await queueDocumentContent(store, documentId, next, queuedAt)

    if (!navigator.onLine) {
      inFlightRef.current = false
      setStatus('offline')

      return
    }

    setStatus('saving')

    let result: Awaited<ReturnType<typeof updateDocumentContent>> | null = null

    try {
      result = await updateDocumentContent(documentId, next)
    } catch {
      inFlightRef.current = false
      setStatus('offline')

      return
    }

    inFlightRef.current = false

    if (result.ok) {
      const current = await readQueuedDocument(store, documentId)

      if (current === null || current.queuedAt === queuedAt) {
        await dropQueuedDocument(store, documentId)
      }

      savedRef.current = next
      setStatus(pendingRef.current === next ? 'saved' : 'pending')

      return
    }

    await dropQueuedDocument(store, documentId)
    setStatus('error')
    toast.error(result.error)
  }, [documentId, enabled])

  const schedule = useCallback(
    (contentJSON: string) => {
      if (!enabled) {
        return
      }

      pendingRef.current = contentJSON

      if (contentJSON === savedRef.current) {
        return
      }

      setStatus(navigator.onLine ? 'pending' : 'offline')

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        void flush()
      }, DEBOUNCE_MS)
    },
    [enabled, flush],
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    let dropped = false

    void readQueuedDocument(offlineStore(), documentId).then((entry) => {
      if (dropped || entry === null || pendingRef.current !== null) {
        return
      }

      pendingRef.current = entry.content
      setStatus(navigator.onLine ? 'pending' : 'offline')

      if (navigator.onLine) {
        void flush()
      }
    })

    return () => {
      dropped = true
    }
  }, [documentId, enabled, flush])

  useEffect(() => {
    if (!enabled) {
      return
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        void flush()
      }
    }

    function handleOnline() {
      void flush()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handleVisibilityChange)
    window.addEventListener('online', handleOnline)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
    }
  }, [enabled, flush])

  useEffect(() => {
    if (!enabled || status !== 'offline') {
      return
    }

    const retry = setInterval(() => void flush(), RETRY_MS)

    return () => {
      clearInterval(retry)
    }
  }, [enabled, flush, status])

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    },
    [],
  )

  const markSaved = useCallback((contentJSON: string) => {
    savedRef.current = contentJSON
    pendingRef.current = contentJSON
    setStatus('idle')
  }, [])

  return { status, schedule, flush, markSaved }
}
