'use client'

import { useEffect, useRef } from 'react'

import { resolveRealtimeUrl } from '@/components/editor/use-document-session'
import {
  type RealtimeSignalTopic,
  readRealtimeSignal,
  realtimeCloseCodes,
  realtimeCloseIsFinal,
  realtimeSignalsUrl,
} from '@/lib/realtime'

import { useRealtimeEndpoint } from './realtime-endpoint-provider'

const firstRetryMs = 1_000
const longestRetryMs = 30_000

export type RealtimeSignalHandlers = Readonly<{
  onSignal: (topic: RealtimeSignalTopic) => void
  onMissedSignals: () => void
  onAccessChange: () => void
}>

export function useRealtimeSignals(
  documentId: string,
  handlers: RealtimeSignalHandlers,
) {
  const endpoint = useRealtimeEndpoint()
  const handlersRef = useRef(handlers)
  const url = endpoint?.url ?? null
  const port = endpoint?.port ?? null

  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    if (port === null) {
      return
    }

    const address = realtimeSignalsUrl(
      resolveRealtimeUrl(url, port, window.location),
      documentId,
    )
    let socket: WebSocket | null = null
    let retryTimer: number | undefined
    let retryMs = firstRetryMs
    let droppedBefore = false
    let disposed = false

    function scheduleRetry() {
      retryTimer = window.setTimeout(connect, retryMs)
      retryMs = Math.min(retryMs * 2, longestRetryMs)
    }

    function connect() {
      if (disposed) {
        return
      }

      const current = new WebSocket(address)

      socket = current

      current.onopen = () => {
        retryMs = firstRetryMs

        if (droppedBefore) {
          handlersRef.current.onMissedSignals()
        }
      }

      current.onmessage = (event: MessageEvent) => {
        const topic =
          typeof event.data === 'string' ? readRealtimeSignal(event.data) : null

        if (topic) {
          handlersRef.current.onSignal(topic)
        }
      }

      current.onclose = (event: CloseEvent) => {
        if (disposed || socket !== current) {
          return
        }

        socket = null
        droppedBefore = true

        if (event.code === realtimeCloseCodes.accessChanged) {
          handlersRef.current.onAccessChange()
        }

        if (realtimeCloseIsFinal(event.code)) {
          handlersRef.current.onAccessChange()

          return
        }

        scheduleRetry()
      }
    }

    connect()

    return () => {
      disposed = true
      window.clearTimeout(retryTimer)
      socket?.close()
      socket = null
    }
  }, [documentId, url, port])
}
