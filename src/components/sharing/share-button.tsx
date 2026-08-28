'use client'

import { useState } from 'react'

import { ShareIcon } from '@/components/icons'
import { SharePanel } from '@/components/sharing/share-panel'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = Readonly<{
  documentId: string
  canShare: boolean
}>

const title = 'Compartilhar documento'
const description = 'Convide pessoas por email ou gere um link público'

export function ShareButton({ documentId, canShare }: Props) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()

  const trigger = (
    <Button type="button" variant="secondary">
      <ShareIcon aria-hidden="true" />
      Compartilhar
    </Button>
  )

  const panel = open ? (
    <SharePanel canManage={canShare} documentId={documentId} />
  ) : null

  if (isMobile) {
    return (
      <Sheet onOpenChange={setOpen} open={open}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
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
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
            {panel}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden sm:max-w-[540px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-gray-700">
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">{panel}</div>
      </DialogContent>
    </Dialog>
  )
}
