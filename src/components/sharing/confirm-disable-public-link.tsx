'use client'

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

const title = 'Desativar o link público?'
const description =
  'Quem tiver o link atual perde o acesso na hora. Se você ativar de novo, o Leaf gera um link diferente.'
const destructiveClassName = 'bg-error-700 text-white hover:bg-error-800'

export function ConfirmDisablePublicLink({
  open,
  pending,
  onOpenChange,
  onConfirm,
}: Props) {
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
            <SheetTitle className="font-bold text-heading-medium text-gray-900">
              {title}
            </SheetTitle>
            <SheetDescription className="text-body-small text-gray-700">
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
              Desativar link
            </Button>
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="secondary"
            >
              Manter ativo
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
          <AlertDialogCancel disabled={pending}>Manter ativo</AlertDialogCancel>
          <AlertDialogAction
            aria-busy={pending}
            className={destructiveClassName}
            disabled={pending}
            onClick={onConfirm}
          >
            Desativar link
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
