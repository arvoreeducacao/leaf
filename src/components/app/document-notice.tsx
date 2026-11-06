'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'

import { useNoticeSlot } from '@/components/app/topbar-slot'
import {
  CancelIcon,
  CloudOffIcon,
  EyeIcon,
  SyncIcon,
  TrashIcon,
} from '@/components/icons'
import { RestoreIcon } from '@/components/icons/outline'
import type { ConnectionStatus } from '@/components/editor/status-bridge'
import {
  onRealtimeReconnectRequest,
  requestRealtimeReconnect,
} from '@/components/editor/status-bridge'
import { Alert } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ButtonIcon } from '@/components/ui/button-icon'
import { restoreDocument } from '@/lib/document-actions'
import {
  connectionNoticeFor,
  lostNoticeDelayMs,
  reconnectingNoticeDelayMs,
} from '@/lib/realtime'
import { useOnlineStatus } from '@/shared/hooks/use-online-status'
import { cn } from '@/shared/utils'

const noticeClass =
  'relative flex min-h-10 w-full items-center justify-center gap-3 rounded-none px-4 py-1.5 sm:px-12 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:translate-y-0'

type Props = Readonly<{
  documentId: string
  connection: ConnectionStatus
  trashed: boolean
  isOwner: boolean
  accessChanged: boolean
  onDismissAccessChange: () => void
  inline?: boolean
}>

function useConnectionNotice(connection: ConnectionStatus) {
  const online = useOnlineStatus()
  const [attempt, setAttempt] = useState(0)
  const [reconnectingForMs, setReconnectingForMs] = useState(0)

  useEffect(
    () => onRealtimeReconnectRequest(() => setAttempt((count) => count + 1)),
    [],
  )

  useEffect(() => {
    setReconnectingForMs(0)

    if (connection !== 'reconnecting') {
      return
    }

    const timers = [reconnectingNoticeDelayMs, lostNoticeDelayMs].map(
      (delay) => window.setTimeout(() => setReconnectingForMs(delay), delay),
    )

    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer)
      }
    }
  }, [attempt, connection])

  return connectionNoticeFor({ online, connection, reconnectingForMs })
}

function TrashedNotice({
  documentId,
  isOwner,
}: Readonly<{ documentId: string; isOwner: boolean }>) {
  const t = useTranslations('realtime')
  const [restoring, startRestoring] = useTransition()

  function restore() {
    startRestoring(async () => {
      const result = await restoreDocument(documentId)

      if (!result.ok) {
        toast.error(result.error)

        return
      }

      requestRealtimeReconnect()
    })
  }

  return (
    <Alert
      className={noticeClass}
      data-testid="document-notice"
      role={undefined}
      variant="error"
    >
      <TrashIcon aria-hidden="true" />
      <p>{isOwner ? t('trashedOwner') : t('trashed')}</p>
      {isOwner ? (
        <Button
          disabled={restoring}
          onClick={restore}
          size="sm"
          type="button"
          variant="secondary"
        >
          <RestoreIcon aria-hidden="true" />
          {t('restore')}
        </Button>
      ) : null}
    </Alert>
  )
}

function AccessChangedNotice({
  onDismiss,
}: Readonly<{ onDismiss: () => void }>) {
  const t = useTranslations('realtime')
  const tCommon = useTranslations('common')

  return (
    <Alert
      className={cn(noticeClass, 'pr-12')}
      data-testid="document-notice"
      role={undefined}
      variant="info"
    >
      <EyeIcon aria-hidden="true" />
      <p>{t('accessChangedToRead')}</p>
      <ButtonIcon
        aria-label={tCommon('close')}
        className="absolute top-1/2 right-3 -translate-y-1/2"
        onClick={onDismiss}
        size="medium"
        variant="ghost"
      >
        <CancelIcon aria-hidden="true" />
      </ButtonIcon>
    </Alert>
  )
}

function ConnectionNotice({
  connection,
}: Readonly<{ connection: ConnectionStatus }>) {
  const t = useTranslations('realtime')
  const notice = useConnectionNotice(connection)

  if (notice === 'none') {
    return null
  }

  if (notice === 'reconnecting') {
    return (
      <Alert
        className={noticeClass}
        data-testid="document-notice"
        role={undefined}
        variant="warning"
      >
        <SyncIcon
          aria-hidden="true"
          className="motion-safe:animate-spin motion-reduce:animate-none"
        />
        <p>{t('reconnecting')}</p>
      </Alert>
    )
  }

  return (
    <Alert
      className={noticeClass}
      data-testid="document-notice"
      role={undefined}
      variant="warning"
    >
      <CloudOffIcon aria-hidden="true" />
      <p>{t('lost')}</p>
      {notice === 'lost' ? (
        <Button
          onClick={requestRealtimeReconnect}
          size="sm"
          type="button"
          variant="secondary"
        >
          {t('retry')}
        </Button>
      ) : null}
    </Alert>
  )
}

export function DocumentNotice({
  documentId,
  connection,
  trashed,
  isOwner,
  accessChanged,
  onDismissAccessChange,
  inline = false,
}: Props) {
  const slot = useNoticeSlot()

  const notice = (
    <div aria-live="polite" role="status">
      {trashed ? (
        <TrashedNotice documentId={documentId} isOwner={isOwner} />
      ) : accessChanged ? (
        <AccessChangedNotice onDismiss={onDismissAccessChange} />
      ) : (
        <ConnectionNotice connection={connection} />
      )}
    </div>
  )

  if (inline) {
    return notice
  }

  return slot ? createPortal(notice, slot) : null
}
