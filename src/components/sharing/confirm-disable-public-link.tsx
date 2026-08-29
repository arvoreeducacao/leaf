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
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}>

const destructiveClassName = 'bg-danger-solid text-content-inverse hover:bg-danger-solid-hover'

export function ConfirmDisablePublicLink({
  open,
  pending,
  onOpenChange,
  onConfirm,
}: Props) {
  const t = useTranslations('share')
  const title = t('confirmDisableTitle')
  const description = t('confirmDisableDescription')
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
              className={destructiveClassName}
              disabled={pending}
              onClick={onConfirm}
              type="button"
              variant="destructive"
            >
              {t('confirmDisableAction')}
            </Button>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="secondary"
            >
              {t('confirmDisableCancel')}
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
            {t('confirmDisableCancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            aria-busy={pending}
            className={destructiveClassName}
            disabled={pending}
            onClick={onConfirm}
          >
            {t('confirmDisableAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
