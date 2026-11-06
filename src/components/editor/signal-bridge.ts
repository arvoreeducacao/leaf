'use client'

import { useEffect, useRef } from 'react'

import type { RealtimeSignalTopic } from '@/lib/realtime'

export type DocumentSignal = Readonly<{
  documentId: string
  topic: RealtimeSignalTopic
}>

const signalEvent = 'leaf:document-signal'

export function publishDocumentSignal(signal: DocumentSignal) {
  window.dispatchEvent(
    new CustomEvent<DocumentSignal>(signalEvent, { detail: signal }),
  )
}

export function onDocumentSignal(handler: (signal: DocumentSignal) => void) {
  function listen(event: Event) {
    handler((event as CustomEvent<DocumentSignal>).detail)
  }

  window.addEventListener(signalEvent, listen)

  return () => {
    window.removeEventListener(signalEvent, listen)
  }
}

export function useDocumentSignal(
  documentId: string | null,
  topic: RealtimeSignalTopic,
  handler: () => void,
  coalesceMs = 0,
) {
  const handlerRef = useRef(handler)

  useEffect(() => {
    handlerRef.current = handler
  })

  useEffect(() => {
    if (!documentId) {
      return
    }

    let timer: number | undefined

    const stop = onDocumentSignal((signal) => {
      if (signal.documentId !== documentId || signal.topic !== topic) {
        return
      }

      if (coalesceMs === 0) {
        handlerRef.current()

        return
      }

      window.clearTimeout(timer)
      timer = window.setTimeout(() => handlerRef.current(), coalesceMs)
    })

    return () => {
      window.clearTimeout(timer)
      stop()
    }
  }, [documentId, topic, coalesceMs])
}
