'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { useRealtimeSignals } from '@/components/app/use-realtime-signals'
import type { DatabaseSnapshot } from '@/lib/databases'

import { DatabaseView } from './database-view'

const refetchDelayMs = 250

type DatabaseResponse = Readonly<{
  snapshot: DatabaseSnapshot
  canEdit: boolean
}>

type FetchedDatabase = DatabaseResponse & Readonly<{ requestedAt: number }>

type Props = Readonly<{
  snapshot: DatabaseSnapshot
  canEdit: boolean
  compact?: boolean
}>

export function LiveDatabaseView({ snapshot, canEdit, compact = false }: Props) {
  const router = useRouter()
  const [current, setCurrent] = useState<FetchedDatabase>({
    snapshot,
    canEdit,
    requestedAt: 0,
  })
  const refetchTimer = useRef<number | undefined>(undefined)
  const latestRequest = useRef(0)
  const pageStale = useRef(false)
  const shownSnapshot = useRef(snapshot)
  const databaseId = snapshot.id

  useEffect(() => {
    return () => {
      window.clearTimeout(refetchTimer.current)
    }
  }, [])

  useEffect(() => {
    if (shownSnapshot.current === snapshot) {
      return
    }

    shownSnapshot.current = snapshot
    refetch(false)
  }, [snapshot])

  function refetch(refreshWhenMissing = true) {
    window.clearTimeout(refetchTimer.current)
    refetchTimer.current = window.setTimeout(async () => {
      if (pageStale.current) {
        pageStale.current = false
        router.refresh()

        return
      }

      const request = ++latestRequest.current
      const requestedAt = Date.now()

      try {
        const response = await fetch(
          `/api/databases/${encodeURIComponent(databaseId)}`,
          { cache: 'no-store' },
        )

        if (request !== latestRequest.current) {
          return
        }

        if (!response.ok) {
          if (!compact && refreshWhenMissing) {
            router.refresh()
          }

          return
        }

        const next = (await response.json()) as DatabaseResponse

        if (request === latestRequest.current) {
          setCurrent({ ...next, requestedAt })
        }
      } catch {
        return
      }
    }, refetchDelayMs)
  }

  useRealtimeSignals(databaseId, {
    onSignal(topic) {
      if (topic === 'document' && !compact) {
        pageStale.current = true
      }

      refetch()
    },
    onMissedSignals: refetch,
    onAccessChange() {
      if (!compact) {
        pageStale.current = true
      }

      refetch()
    },
  })

  return (
    <DatabaseView
      canEdit={current.canEdit}
      compact={compact}
      requestedAt={current.requestedAt}
      snapshot={current.snapshot}
    />
  )
}
