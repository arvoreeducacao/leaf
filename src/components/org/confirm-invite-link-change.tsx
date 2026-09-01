'use client'

import { useTranslations } from 'next-intl'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = Readonly<{
  mode: 'disable' | 'reset'
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}>

const destructiveClassName =
  'bg-danger-solid text-content-inverse hover:bg-danger-solid-hover'

export function ConfirmInviteLinkChange({
  mode,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: Props) {
  const t = useTranslations('org')
  const disable = mode === 'disable'
  const title = disable
    ? t('confirmLinkDisableTitle')
    : t('confirmLinkResetTitle')
  const description = disable
    ? t('confirmLinkDisableDescription')
    : t('confirmLinkResetDescription')
  const action = disable
    ? t('confirmLinkDisableAction')
    : t('confirmLinkResetAction')
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent
          className="max-h-[85dvh]"
          role="alertdialog"
          showClose={false}
          side="bottom"
        >
          <SheetHeader className="gap-2 px-4 pt-4">
            <SheetTitle className="font-bold text-heading-medium text-content-strong">
              {title}
            </SheetTitle>
            <SheetDescription className="text-body-small text-content">
              {description}
            </SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button
              aria-busy={pending}
              className={disable ? destructiveClassName : undefined}
              disabled={pending}
              onClick={onConfirm}
              type="button"
              variant={disable ? 'destructive' : 'default'}
            >
              {action}
            </Button>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="secondary"
            >
              {t('confirmLinkCancel')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t('confirmLinkCancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            aria-busy={pending}
            className={disable ? destructiveClassName : undefined}
            disabled={pending}
            onClick={onConfirm}
          >
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
