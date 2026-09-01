'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState } from 'react'

import type { ImportEvent, ImportSummary } from '@/lib/notion/import'

export type ImportProgress = Readonly<{
  phase: 'assets' | 'pages' | 'reading'
  done: number
  total: number
}>

export type ImportStream = Readonly<{
  running: boolean
  started: boolean
  progress: ImportProgress | null
  summary: ImportSummary | null
  error: string | null
  start: (url: string, body: BodyInit, headers?: HeadersInit) => Promise<void>
  abort: () => void
  reset: () => void
}>

export function useImportStream(): ImportStream {
  const t = useTranslations('archiveImport')
  const router = useRouter()
  const abortRef = useRef<AbortController | null>(null)

  const [running, setRunning] = useState(false)
  const [started, setStarted] = useState(false)
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setRunning(false)
    setStarted(false)
    setProgress(null)
    setSummary(null)
    setError(null)
  }, [])

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const start = useCallback(
    async (url: string, body: BodyInit, headers?: HeadersInit) => {
      const controller = new AbortController()
      abortRef.current = controller

      setStarted(true)
      setRunning(true)
      setProgress(null)
      setSummary(null)
      setError(null)

      try {
        const response = await fetch(url, {
          body,
          headers,
          method: 'POST',
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          const payload: unknown = await response.json().catch(() => null)

          setError(
            payload && typeof payload === 'object' && 'error' in payload
              ? String((payload as { error: unknown }).error)
              : t('failed'),
          )
          setRunning(false)

          return
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            break
          }

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (line.trim().length === 0) {
              continue
            }

            const event = JSON.parse(line) as ImportEvent

            if (event.type === 'progress') {
              setProgress({
                done: event.done,
                phase: event.phase,
                total: event.total,
              })
            }

            if (event.type === 'done') {
              setSummary(event.summary)
              router.refresh()
            }

            if (event.type === 'error') {
              setError(event.error)
            }
          }
        }
      } catch {
        setError(controller.signal.aborted ? t('cancelled') : t('failed'))
      } finally {
        setRunning(false)
        router.refresh()
      }
    },
    [router, t],
  )

  return { abort, error, progress, reset, running, start, started, summary }
}
