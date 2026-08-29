import { useTranslations } from 'next-intl'

import { CheckCircleIcon, SyncIcon, WarningIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

type Props = Readonly<{
  status: SaveStatus
  onRetry?: () => void
}>

const labelKeys: Record<Exclude<SaveStatus, 'idle'>, string> = {
  pending: 'savePending',
  saving: 'saveSaving',
  saved: 'saveSaved',
  error: 'saveError',
}

export function SaveIndicator({ status, onRetry }: Props) {
  const t = useTranslations('editor')
  const tCommon = useTranslations('common')
  const label = status === 'idle' ? '' : t(labelKeys[status])
  const isError = status === 'error'
  const isSettled = status === 'saved' || isError

  return (
    <div className="flex items-center gap-3">
      <span aria-live="polite" className="sr-only" role="status">
        {isSettled ? label : ''}
      </span>

      {status === 'idle' ? null : (
        <p
          aria-hidden="true"
          className={`flex items-center gap-2 text-body-small ${
            isError ? 'text-danger' : 'text-content'
          }`}
        >
          {status === 'saved' ? (
            <CheckCircleIcon aria-hidden="true" className="size-4" />
          ) : null}
          {status === 'saving' ? (
            <SyncIcon
              aria-hidden="true"
              className="size-4 motion-safe:animate-spin motion-reduce:animate-none"
            />
          ) : null}
          {status === 'pending' ? (
            <SyncIcon aria-hidden="true" className="size-4" />
          ) : null}
          {isError ? <WarningIcon aria-hidden="true" className="size-4" /> : null}
          {label}
        </p>
      )}

      {isError && onRetry ? (
        <Button onClick={onRetry} size="sm" type="button" variant="secondary">
          {tCommon('tryAgain')}
        </Button>
      ) : null}
    </div>
  )
}
