'use client'

import { useTranslations } from 'next-intl'

import {
  CheckCircleIcon,
  CloudCheckIcon,
  CloudOffIcon,
  EyeIcon,
  SyncIcon,
  WarningIcon,
} from '@/components/icons'
import type {
  ConnectionStatus,
  SaveStatus,
} from '@/components/editor/status-bridge'
import {
  readOnlyHintId,
  requestRealtimeReconnect,
  requestSaveRetry,
  useEditorStatus,
} from '@/components/editor/status-bridge'
import { Button } from '@/components/ui/button'
import { useOnlineStatus } from '@/shared/hooks/use-online-status'
import { cn } from '@/shared/utils'

const saveLabelKeys: Record<SaveStatus, string> = {
  idle: '',
  pending: 'savePending',
  saving: 'saveSaving',
  saved: 'saveSaved',
  error: 'saveError',
  offline: 'saveOffline',
}

function ConnectionChip({
  connection,
  online,
}: Readonly<{ connection: ConnectionStatus; online: boolean }>) {
  const t = useTranslations('realtime')
  const tOffline = useTranslations('offline')

  if (online && connection === 'solo') {
    return null
  }

  if (!online || connection === 'offline') {
    return (
      <>
        <span aria-live="polite" className="sr-only" role="status">
          {tOffline('badge')}
        </span>
        <p className="flex items-center gap-1 whitespace-nowrap text-content-subtle">
          <CloudOffIcon aria-hidden="true" className="size-3.5" />
          {tOffline('badge')}
        </p>
      </>
    )
  }

  if (connection === 'lost') {
    return (
      <>
        <span aria-live="polite" className="sr-only" role="status">
          {t('lost')}
        </span>
        <p className="flex items-center gap-1 whitespace-nowrap text-content-subtle">
          <CloudOffIcon aria-hidden="true" className="size-3.5" />
          {t('lost')}
        </p>
        <button
          className="cursor-pointer whitespace-nowrap underline underline-offset-2 hover:text-content-strong"
          onClick={requestRealtimeReconnect}
          type="button"
        >
          {t('retry')}
        </button>
      </>
    )
  }

  return (
    <>
      <span aria-live="polite" className="sr-only" role="status">
        {t('reconnecting')}
      </span>
      <p className="flex items-center gap-1 whitespace-nowrap text-warn">
        <SyncIcon
          aria-hidden="true"
          className="size-3.5 motion-safe:animate-spin motion-reduce:animate-none"
        />
        {t('reconnecting')}
      </p>
    </>
  )
}

export function DocumentStatus() {
  const t = useTranslations('editor')
  const tCommon = useTranslations('common')
  const tOffline = useTranslations('offline')
  const { ready, readOnly, save, connection, conflict } = useEditorStatus()
  const online = useOnlineStatus()

  if (!ready) {
    return null
  }

  const saveLabel = save === 'idle' ? '' : t(saveLabelKeys[save])
  const isError = save === 'error'
  const isQueued = save === 'offline'
  const showSave =
    online && connection !== 'connected' && !readOnly && save !== 'idle'

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-content-subtle">
      {readOnly ? (
        <p className="flex items-center gap-1" id={readOnlyHintId}>
          <EyeIcon aria-hidden="true" className="size-3.5" />
          {t('readOnly')}
        </p>
      ) : null}

      <ConnectionChip connection={connection} online={online} />

      {showSave ? (
        <>
          <span aria-live="polite" className="sr-only" role="status">
            {save === 'saved' || isError || isQueued ? saveLabel : ''}
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
            {isQueued ? (
              <CloudCheckIcon aria-hidden="true" className="size-3.5" />
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

      {conflict ? (
        <p className="flex items-center gap-1 whitespace-nowrap text-warn">
          <WarningIcon aria-hidden="true" className="size-3.5" />
          {tOffline('conflict')}
        </p>
      ) : null}
    </div>
  )
}
