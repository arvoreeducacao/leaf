'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import type { DatabaseSnapshot } from '@/lib/databases'

import { DatabaseView } from './database-view'

type State =
  | Readonly<{ status: 'loading' }>
  | Readonly<{ status: 'missing' }>
  | Readonly<{ status: 'ready'; snapshot: DatabaseSnapshot; canEdit: boolean }>

type DatabaseResponse = Readonly<{
  snapshot: DatabaseSnapshot
  canEdit: boolean
}>

type Props = Readonly<{ databaseId: string }>

export default function DatabaseEmbed({ databaseId }: Props) {
  const t = useTranslations('database')
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let active = true

    setState({ status: 'loading' })

    const abort = new AbortController()

    fetch(`/api/databases/${encodeURIComponent(databaseId)}`, {
      cache: 'no-store',
      signal: abort.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((result: DatabaseResponse | null) => {
        if (!active) {
          return
        }

        setState(
          result
            ? {
                status: 'ready',
                snapshot: result.snapshot,
                canEdit: result.canEdit,
              }
            : { status: 'missing' },
        )
      })
      .catch(() => {
        if (active) {
          setState({ status: 'missing' })
        }
      })

    return () => {
      active = false
      abort.abort()
    }
  }, [databaseId])

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-2 py-1">
        <span className="sr-only">{t('blockLoading')}</span>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  if (state.status === 'missing') {
    return (
      <p className="rounded-large border border-line bg-surface-subtle px-3 py-4 text-body-small text-content">
        {t('blockMissing')}
      </p>
    )
  }

  return (
    <DatabaseView canEdit={state.canEdit} compact snapshot={state.snapshot} />
  )
}
