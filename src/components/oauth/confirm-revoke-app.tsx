'use client'

import { useTranslations } from 'next-intl'
import { useRef } from 'react'

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
import { Button, buttonVariants } from '@/components/ui/button'
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
  name: string
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}>

export function ConfirmRevokeApp({
  name,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: Props) {
  const t = useTranslations('connectedApps')
  const title = t('confirmTitle', { name })
  const description = t('confirmDescription')
  const isMobile = useIsMobile()
  const cancelRef = useRef<HTMLButtonElement>(null)

  if (isMobile) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent
          className="max-h-[85dvh]"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            cancelRef.current?.focus()
          }}
          onPointerDownOutside={(event) => event.preventDefault()}
          role="alertdialog"
          showClose={false}
          side="bottom"
        >
          <SheetHeader className="gap-2 px-4 pt-4">
            <SheetTitle className="font-bold text-content-strong">{title}</SheetTitle>
            <SheetDescription className="text-content">{description}</SheetDescription>
          </SheetHeader>
          <SheetFooter>
            <Button
              aria-busy={pending}
              disabled={pending}
              onClick={onConfirm}
              type="button"
              variant="destructive"
            >
              {t('confirmAction')}
            </Button>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              ref={cancelRef}
              type="button"
              variant="secondary"
            >
              {t('confirmCancel')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent onEscapeKeyDown={(event) => event.preventDefault()}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{t('confirmCancel')}</AlertDialogCancel>
          <AlertDialogAction
            aria-busy={pending}
            className={buttonVariants({ variant: 'destructive' })}
            disabled={pending}
            onClick={onConfirm}
          >
            {t('confirmAction')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
