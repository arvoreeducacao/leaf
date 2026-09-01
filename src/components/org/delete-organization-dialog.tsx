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
  orgName: string
  open: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}>

const destructiveClassName =
  'bg-danger-solid text-white hover:bg-danger-solid-hover'

export function DeleteOrganizationDialog({
  orgName,
  open,
  pending,
  onOpenChange,
  onConfirm,
}: Props) {
  const t = useTranslations('org')
  const title = t('deleteOrgTitle', { name: orgName })
  const description = t('deleteOrgDescription')
  const isMobile = useIsMobile()
  const cancelRef = useRef<HTMLButtonElement>(null)

  if (isMobile) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent
          className="max-h-[85dvh]"
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
              size="lg"
              type="button"
              variant="destructive"
            >
              {t('deleteOrgConfirm')}
            </Button>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              ref={cancelRef}
              size="lg"
              type="button"
              variant="secondary"
            >
              {t('deleteOrgCancel')}
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
            {t('deleteOrgCancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            aria-busy={pending}
            className={destructiveClassName}
            data-testid="confirm-delete-org"
            disabled={pending}
            onClick={onConfirm}
          >
            {t('deleteOrgConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
