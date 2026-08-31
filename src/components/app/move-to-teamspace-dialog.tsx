'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { PadlockIcon, UsersIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { TeamspaceTarget } from '@/lib/teamspace-actions'
import {
  listTeamspaceTargets,
  moveDocumentToTeamspace,
} from '@/lib/teamspace-actions'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  documentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}>

const privateValue = 'private'

export function MoveToTeamspaceDialog({
  documentId,
  open,
  onOpenChange,
}: Props) {
  const t = useTranslations('teamspace')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const isMobile = useIsMobile()

  const [targets, setTargets] = useState<Array<TeamspaceTarget> | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState(false)
  const [selected, setSelected] = useState(privateValue)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const result = await listTeamspaceTargets(documentId)

    if (result.ok) {
      setTargets(result.targets)
      setSelected(result.currentTeamspaceId ?? privateValue)
    } else {
      setLoadError(result.error)
    }

    setLoading(false)
  }, [documentId])

  useEffect(() => {
    if (!open) {
      return
    }

    void load()
  }, [open, load])

  async function submit() {
    setPending(true)
    const result = await moveDocumentToTeamspace(
      documentId,
      selected === privateValue ? null : selected,
    )
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)

      return
    }

    toast.success(t('documentMoved'))
    onOpenChange(false)
    router.refresh()
  }

  const title = t('moveTitle')
  const description = t('moveDescription')

  const body = (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : null}

      {loadError ? (
        <div className="flex flex-col items-start gap-2" role="alert">
          <p className="text-body-small text-danger">{loadError}</p>
          <Button onClick={() => void load()} type="button" variant="secondary">
            {tCommon('tryAgain')}
          </Button>
        </div>
      ) : null}

      {!loading && !loadError ? (
        <RadioGroup
          aria-label={t('moveGroupLabel')}
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
          onValueChange={setSelected}
          value={selected}
        >
          <TeamspaceOption
            checked={selected === privateValue}
            hint={t('movePrivateHint')}
            icon={
              <PadlockIcon aria-hidden="true" className="size-4 shrink-0" />
            }
            label={t('movePrivate')}
            value={privateValue}
          />

          {(targets ?? []).map((target) => (
            <TeamspaceOption
              checked={selected === target.id}
              hint={t('moveTeamspaceHint')}
              icon={<UsersIcon aria-hidden="true" className="size-4 shrink-0" />}
              key={target.id}
              label={target.name}
              value={target.id}
            />
          ))}

          {targets?.length === 0 ? (
            <p className="px-3 py-2 text-body-small text-content">
              {t('moveNoTargets')}
            </p>
          ) : null}
        </RadioGroup>
      ) : null}
    </div>
  )

  const actions = (
    <>
      <Button
        className="w-full tablet:w-auto"
        disabled={pending}
        onClick={() => onOpenChange(false)}
        type="button"
        variant="secondary"
      >
        {tCommon('cancel')}
      </Button>
      <Button
        aria-busy={pending}
        className="w-full tablet:w-auto"
        disabled={pending || loading || loadError !== null}
        onClick={() => void submit()}
        type="button"
      >
        {t('moveSubmit')}
      </Button>
    </>
  )

  if (isMobile) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent
          className="max-h-[85dvh] overflow-hidden"
          showClose={false}
          side="bottom"
        >
          <SheetHeader
            className="shrink-0"
            subtitle={description}
            title={title}
            type="close"
          />
          <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 pb-6">
            {body}
            <div className="flex flex-col gap-2">{actions}</div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden tablet:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-content">
            {description}
          </DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter className="shrink-0">{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TeamspaceOption({
  value,
  label,
  hint,
  icon,
  checked,
}: Readonly<{
  value: string
  label: string
  hint: string
  icon: React.ReactNode
  checked: boolean
}>) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-center gap-3 rounded-large px-3 py-2 transition-colors',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-offset-2',
        checked ? 'bg-brand-surface' : 'hover:bg-surface-hover',
      )}
    >
      <RadioGroupItem value={value} />
      {icon}
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'truncate text-body-small text-content-strong',
            checked ? 'font-bold' : '',
          )}
        >
          {label}
        </span>
        <span className="truncate text-body-small text-content">{hint}</span>
      </span>
    </label>
  )
}
