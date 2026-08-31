'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import type { TeamspaceAccess } from '@/db/schema'
import { createTeamspace, updateTeamspace } from '@/lib/teamspace-actions'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  open: boolean
  onOpenChange: (open: boolean) => void
  teamspace?: { id: string; name: string; access: TeamspaceAccess } | null
}>

export function TeamspaceFormDialog({ open, onOpenChange, teamspace }: Props) {
  const t = useTranslations('teamspace')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const isMobile = useIsMobile()
  const nameId = useId()
  const errorId = useId()

  const [name, setName] = useState(teamspace?.name ?? '')
  const [access, setAccess] = useState<TeamspaceAccess>(
    teamspace?.access ?? 'open',
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    setName(teamspace?.name ?? '')
    setAccess(teamspace?.access ?? 'open')
    setError(null)
  }, [open, teamspace?.name, teamspace?.access])

  const title = teamspace ? t('editTitle') : t('createTitle')
  const description = teamspace ? t('editDescription') : t('createDescription')

  async function submit() {
    setPending(true)
    setError(null)

    const result = teamspace
      ? await updateTeamspace(teamspace.id, name, access)
      : await createTeamspace(name, access)

    setPending(false)

    if (!result.ok) {
      setError(result.error)

      return
    }

    toast.success(teamspace ? t('updated') : t('created'))
    onOpenChange(false)
    router.refresh()
  }

  const body = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>{t('nameLabel')}</Label>
        <Input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          disabled={pending}
          id={nameId}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder={t('namePlaceholder')}
          value={name}
        />
      </div>

      <RadioGroup
        aria-label={t('accessLabel')}
        className="flex flex-col gap-1"
        onValueChange={(value) => setAccess(value as TeamspaceAccess)}
        value={access}
      >
        <AccessOption
          checked={access === 'open'}
          hint={t('accessOpenHint')}
          label={t('accessOpen')}
          value="open"
        />
        <AccessOption
          checked={access === 'closed'}
          hint={t('accessClosedHint')}
          label={t('accessClosed')}
          value="closed"
        />
      </RadioGroup>

      {error ? (
        <p
          className="rounded-large bg-danger-surface p-3 text-body-small text-danger"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
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
        disabled={pending || name.trim().length === 0}
        onClick={() => void submit()}
        type="button"
      >
        {teamspace ? t('save') : t('create')}
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
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-6">
            {body}
            <div className="flex flex-col gap-2">{actions}</div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="tablet:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-content">
            {description}
          </DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AccessOption({
  value,
  label,
  hint,
  checked,
}: Readonly<{
  value: string
  label: string
  hint: string
  checked: boolean
}>) {
  return (
    <label
      className={cn(
        'flex min-h-11 cursor-pointer items-start gap-3 rounded-large px-3 py-2 transition-colors',
        'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-offset-2',
        checked ? 'bg-brand-surface' : 'hover:bg-surface-hover',
      )}
    >
      <span className="flex h-6 items-center">
        <RadioGroupItem value={value} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'text-body-small text-content-strong',
            checked ? 'font-bold' : '',
          )}
        >
          {label}
        </span>
        <span className="text-body-small text-content">{hint}</span>
      </span>
    </label>
  )
}
