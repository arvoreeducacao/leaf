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
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { renameDocument } from '@/lib/document-actions'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = Readonly<{
  documentId: string
  title: string
  open: boolean
  onOpenChange: (open: boolean) => void
}>

export function RenameDocumentDialog({
  documentId,
  title,
  open,
  onOpenChange,
}: Props) {
  const t = useTranslations('document')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const isMobile = useIsMobile()
  const nameId = useId()

  const [value, setValue] = useState(title)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) {
      setValue(title)
    }
  }, [open, title])

  async function submit() {
    setPending(true)
    const result = await renameDocument(documentId, value)
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)

      return
    }

    onOpenChange(false)
    router.refresh()
  }

  const body = (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Label htmlFor={nameId}>{t('renameFieldLabel')}</Label>
      <Input
        autoComplete="off"
        autoFocus
        disabled={pending}
        id={nameId}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('untitled')}
        value={value}
      />
    </form>
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
        disabled={pending}
        onClick={() => void submit()}
        type="button"
      >
        {t('renameSubmit')}
      </Button>
    </>
  )

  if (isMobile) {
    return (
      <Sheet onOpenChange={onOpenChange} open={open}>
        <SheetContent showClose={false} side="bottom">
          <SheetHeader
            subtitle={t('renameDescription')}
            title={t('rename')}
            type="close"
          />
          <div className="flex flex-col gap-4 px-4 pb-6">
            {body}
            <div className="flex flex-col gap-2">{actions}</div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="tablet:max-w-110">
        <DialogHeader>
          <DialogTitle>{t('rename')}</DialogTitle>
          <DialogDescription className="text-content">
            {t('renameDescription')}
          </DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
