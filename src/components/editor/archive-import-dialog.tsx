'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { ImportDestinationPicker } from '@/components/editor/import-destination-picker'
import { ImportProgress } from '@/components/editor/import-progress'
import { useImportStream } from '@/components/editor/use-import-stream'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { listImportDestinations } from '@/lib/import-actions'
import type { ImportDestinationsResult } from '@/lib/import-actions'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = Readonly<{
  file: File | null
  parentId: string
  onOpenChange: (open: boolean) => void
}>

export function ArchiveImportDialog({ file, parentId, onOpenChange }: Props) {
  const t = useTranslations('archiveImport')
  const tCommon = useTranslations('common')
  const title = t('title')
  const description = t('description')
  const router = useRouter()
  const isMobile = useIsMobile()
  const stream = useImportStream()
  const { reset } = stream

  const [destinations, setDestinations] =
    useState<ImportDestinationsResult | null>(null)
  const [destination, setDestination] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setDestinations(null)
      setDestination(null)
      reset()

      return
    }

    let active = true

    void listImportDestinations(parentId).then((result) => {
      if (!active) {
        return
      }

      setDestinations(result)
      setDestination((current) => current ?? result.suggested)
    })

    return () => {
      active = false
    }
  }, [file, parentId, reset])

  function begin() {
    if (!file || !destination) {
      return
    }

    const body = new FormData()
    body.append('file', file)
    body.append('parentId', parentId)
    body.append('destination', destination)

    void stream.start('/api/import/notion', body)
  }

  const actions = !stream.started ? (
    <div className="flex flex-col gap-2 tablet:flex-row-reverse">
      <Button
        className="w-full tablet:w-auto"
        disabled={!destination || destinations === null}
        onClick={begin}
        type="button"
      >
        {t('startImport')}
      </Button>
      <Button
        className="w-full tablet:w-auto"
        onClick={() => onOpenChange(false)}
        type="button"
        variant="secondary"
      >
        {tCommon('cancel')}
      </Button>
    </div>
  ) : stream.summary?.rootId ? (
    <Button
      className="w-full tablet:w-auto"
      onClick={() => {
        const rootId = stream.summary?.rootId

        onOpenChange(false)

        if (rootId) {
          router.push(`/doc/${rootId}`)
        }
      }}
      type="button"
    >
      {t('openDocument')}
    </Button>
  ) : stream.running ? (
    <Button
      className="w-full tablet:w-auto"
      onClick={stream.abort}
      type="button"
      variant="secondary"
    >
      {t('cancelImport')}
    </Button>
  ) : stream.error && file ? (
    <Button
      className="w-full tablet:w-auto"
      onClick={begin}
      type="button"
      variant="secondary"
    >
      {tCommon('tryAgain')}
    </Button>
  ) : null

  const content = stream.started ? (
    <ImportProgress stream={stream} />
  ) : (
    <ImportDestinationPicker
      destination={destination}
      destinations={destinations}
      onChange={setDestination}
    />
  )

  function closeOrAbort(open: boolean) {
    if (!open && stream.running) {
      stream.abort()
    }

    onOpenChange(open)
  }

  if (isMobile) {
    return (
      <Sheet onOpenChange={closeOrAbort} open={file !== null}>
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
            {content}
            {actions ? (
              <div className="flex flex-col gap-2">{actions}</div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog onOpenChange={closeOrAbort} open={file !== null}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden tablet:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-content">
            {description}
          </DialogDescription>
        </DialogHeader>
        {content}
        {actions ? (
          <DialogFooter className="shrink-0">{actions}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
