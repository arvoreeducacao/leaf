import { CheckCircleIcon, SyncIcon, WarningIcon } from '@/components/icons'

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

type Props = Readonly<{ status: SaveStatus }>

const labels: Record<Exclude<SaveStatus, 'idle'>, string> = {
  pending: 'Alterações não salvas',
  saving: 'Salvando',
  saved: 'Salvo',
  error: 'Não foi possível salvar',
}

export function SaveIndicator({ status }: Props) {
  if (status === 'idle') {
    return <p aria-live="polite" className="sr-only" role="status" />
  }

  const label = labels[status]
  const isError = status === 'error'

  return (
    <p
      aria-live="polite"
      className={`flex items-center gap-2 text-body-small ${
        isError ? 'text-error-600' : 'text-gray-600'
      }`}
      role="status"
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
  )
}
