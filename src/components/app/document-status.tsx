'use client'

import { useTranslations } from 'next-intl'

import {
  CheckCircleIcon,
  EyeIcon,
  SyncIcon,
  UsersIcon,
  WarningIcon,
} from '@/components/icons'
import type { SaveStatus } from '@/components/editor/status-bridge'
import {
  readOnlyHintId,
  requestSaveRetry,
  useEditorStatus,
} from '@/components/editor/status-bridge'
import { Button } from '@/components/ui/button'
import { cn } from '@/shared/utils'

const saveLabelKeys: Record<SaveStatus, string> = {
  idle: '',
  pending: 'savePending',
  saving: 'saveSaving',
  saved: 'saveSaved',
  error: 'saveError',
}

export function DocumentStatus() {
  const t = useTranslations('editor')
  const tCommon = useTranslations('common')
  const tRealtime = useTranslations('realtime')
  const { ready, readOnly, save, stats, realtime } = useEditorStatus()

  if (!ready) {
    return null
  }

  const saveLabel = save === 'idle' ? '' : t(saveLabelKeys[save])
  const isError = save === 'error'
  const connected = realtime === 'connected'

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-content-subtle">
      {readOnly ? (
        <p className="flex items-center gap-1" id={readOnlyHintId}>
          <EyeIcon aria-hidden="true" className="size-3.5" />
          {t('readOnly')}
        </p>
      ) : null}

      {stats ? (
        <p className="flex items-center gap-1 whitespace-nowrap">
          <span>{t('words', { count: stats.words })}</span>
          <span aria-hidden="true" className="hidden tablet:inline">
            ·
          </span>
          <span className="hidden tablet:inline">
            {t('characters', { count: stats.characters })}
          </span>
        </p>
      ) : null}

      {realtime !== 'off' ? (
        <>
          <span aria-live="polite" className="sr-only" role="status">
            {connected ? '' : tRealtime('reconnecting')}
          </span>
          <p
            className={cn(
              'flex items-center gap-1 whitespace-nowrap',
              connected ? '' : 'text-warn',
            )}
          >
            {connected ? (
              <UsersIcon aria-hidden="true" className="size-3.5" />
            ) : (
              <SyncIcon
                aria-hidden="true"
                className="size-3.5 motion-safe:animate-spin motion-reduce:animate-none"
              />
            )}
            {connected ? tRealtime('connected') : tRealtime('reconnecting')}
          </p>
        </>
      ) : null}

      {realtime === 'off' && !readOnly && save !== 'idle' ? (
        <>
          <span aria-live="polite" className="sr-only" role="status">
            {save === 'saved' || isError ? saveLabel : ''}
          </span>
          <p
            aria-hidden="true"
            className={cn(
              'flex items-center gap-1 whitespace-nowrap',
              isError && 'text-danger',
            )}
          >
            {save === 'saved' ? (
              <CheckCircleIcon aria-hidden="true" className="size-3.5" />
            ) : null}
            {save === 'saving' ? (
              <SyncIcon
                aria-hidden="true"
                className="size-3.5 motion-safe:animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {isError ? (
              <WarningIcon aria-hidden="true" className="size-3.5" />
            ) : null}
            {saveLabel}
          </p>
          {isError ? (
            <Button
              onClick={() => requestSaveRetry()}
              size="sm"
              type="button"
              variant="secondary"
            >
              {tCommon('tryAgain')}
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
