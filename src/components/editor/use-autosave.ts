'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { updateDocumentContent } from '@/lib/document-actions'

import type { SaveStatus } from './save-indicator'

const DEBOUNCE_MS = 1000

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

    inFlightRef.current = true
    setStatus('saving')

    const result = await updateDocumentContent(documentId, next)

    inFlightRef.current = false

    if (result.ok) {
      savedRef.current = next
      setStatus(pendingRef.current === next ? 'saved' : 'pending')
      return
    }

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

      setStatus('pending')

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null
        void flush()
      }, DEBOUNCE_MS)
    },
    [enabled, flush]
  )

  useEffect(() => {
    if (!enabled) {
      return
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        void flush()
      }
    }

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (
        pendingRef.current !== null &&
        pendingRef.current !== savedRef.current
      ) {
        event.preventDefault()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [enabled, flush])

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    },
    []
  )

  return { status, schedule, flush }
}
