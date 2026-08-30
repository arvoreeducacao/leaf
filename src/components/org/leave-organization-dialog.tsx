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

const destructiveClassName =
  'bg-danger-solid text-content-inverse hover:bg-danger-solid-hover'

export function LeaveOrganizationDialog({
  open,
  pending,
  onOpenChange,
  onConfirm,
}: Props) {
  const t = useTranslations('org')
  const title = t('leaveTitle')
  const description = t('leaveDescription')
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent
          className="max-h-[85dvh]"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
          role="alertdialog"
          showClose={false}
          side="bottom"
        >
          <SheetHeader className="gap-2 px-4 pt-4">
            <SheetTitle className="font-bold text-content-strong">
              {title}
            </SheetTitle>
            <SheetDescription className="text-content">
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
              {t('leaveConfirm')}
            </Button>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="secondary"
            >
              {t('leaveCancel')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t('leaveCancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            aria-busy={pending}
            className={destructiveClassName}
            disabled={pending}
            onClick={onConfirm}
          >
            {t('leaveConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
