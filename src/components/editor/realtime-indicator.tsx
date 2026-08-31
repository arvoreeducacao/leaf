'use client'

import { useTranslations } from 'next-intl'

import { SyncIcon, UsersIcon } from '@/components/icons'
import { cn } from '@/shared/utils'

type Props = Readonly<{ connected: boolean }>

export function RealtimeIndicator({ connected }: Props) {
  const t = useTranslations('realtime')
  const label = connected ? t('connected') : t('reconnecting')

  return (
    <div className="flex items-center gap-3">
      <span aria-live="polite" className="sr-only" role="status">
        {connected ? '' : label}
      </span>
      <p
        aria-hidden="true"
        className={cn(
          'flex items-center gap-2 text-body-small',
          connected ? 'text-content' : 'text-warn',
        )}
      >
        {connected ? (
          <UsersIcon aria-hidden="true" className="size-4" />
        ) : (
          <SyncIcon
            aria-hidden="true"
            className="size-4 motion-safe:animate-spin motion-reduce:animate-none"
          />
        )}
        {label}
      </p>
    </div>
  )
}
