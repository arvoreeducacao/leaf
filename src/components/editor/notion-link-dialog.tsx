'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useState } from 'react'

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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { listImportDestinations, previewNotionLink } from '@/lib/import-actions'
import type {
  ImportDestinationsResult,
  NotionPreview,
} from '@/lib/import-actions'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = Readonly<{
  open: boolean
  parentId: string
  onOpenChange: (open: boolean) => void
}>

export function NotionLinkDialog({ open, parentId, onOpenChange }: Props) {
  const t = useTranslations('notionLink')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const isMobile = useIsMobile()
  const stream = useImportStream()
  const { reset } = stream
  const linkId = useId()

  const [link, setLink] = useState('')
  const [preview, setPreview] = useState<NotionPreview | null>(null)
  const [checking, setChecking] = useState(false)
  const [withComments, setWithComments] = useState(false)
  const [destinations, setDestinations] =
    useState<ImportDestinationsResult | null>(null)
  const [destination, setDestination] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setLink('')
      setPreview(null)
      setWithComments(false)
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
  }, [open, parentId, reset])

  async function check() {
    setChecking(true)

    try {
      setPreview(await previewNotionLink(link))
    } finally {
      setChecking(false)
    }
  }

  function begin() {
    if (!destination) {
      return
    }

    void stream.start(
      '/api/import/notion/link',
      JSON.stringify({ comments: withComments, destination, link, parentId }),
      { 'Content-Type': 'application/json' },
    )
  }

  const ready = preview?.state === 'ready'

  const previewMessage =
    preview === null
      ? null
      : preview.state === 'ready'
        ? t('previewReady', {
            databases: preview.childDatabases,
            pages: preview.childPages,
            title: preview.title || t('untitledPage'),
          })
        : t(preview.state)

  const form = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <div className="flex flex-col gap-2">
        <Label htmlFor={linkId}>{t('linkLabel')}</Label>
        <Input
          autoComplete="off"
          id={linkId}
          onChange={(event) => {
            setLink(event.target.value)
            setPreview(null)
          }}
          placeholder={t('linkPlaceholder')}
          spellCheck={false}
          value={link}
        />
        <p className="text-body-small text-content">{t('linkHelp')}</p>
      </div>

      {previewMessage ? (
        <p
          className={
            ready
              ? 'text-body-small text-content-strong'
              : 'text-body-small text-danger'
          }
          role={ready ? undefined : 'alert'}
        >
          {previewMessage}
        </p>
      ) : null}

      {ready ? (
        <>
          <ImportDestinationPicker
            destination={destination}
            destinations={destinations}
            onChange={setDestination}
          />

          <label className="flex cursor-pointer items-start gap-3 rounded-large px-3 py-2 transition-colors hover:bg-surface-hover has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:outline-offset-2">
            <Switch
              checked={withComments}
              className="mt-1"
              onCheckedChange={setWithComments}
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-small text-content-strong">
                {t('withComments')}
              </span>
              <span className="text-body-small text-content">
                {t('withCommentsHint')}
              </span>
            </span>
          </label>
        </>
      ) : null}
    </div>
  )

  const actions = stream.started ? (
    stream.summary?.rootId ? (
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
    ) : null
  ) : (
    <div className="flex flex-col gap-2 tablet:flex-row-reverse">
      {preview?.state === 'disconnected' ? (
        <Button asChild className="w-full tablet:w-auto">
          <a href="/api/notion/connect">{t('connect')}</a>
        </Button>
      ) : (
        <Button
          className="w-full tablet:w-auto"
          disabled={
            checking || link.trim().length === 0 || (ready && !destination)
          }
          onClick={() => (ready ? begin() : void check())}
          type="button"
        >
          {ready ? t('startImport') : t('checkLink')}
        </Button>
      )}
      <Button
        className="w-full tablet:w-auto"
        onClick={() => onOpenChange(false)}
        type="button"
        variant="secondary"
      >
        {tCommon('cancel')}
      </Button>
    </div>
  )

  const content = stream.started ? <ImportProgress stream={stream} /> : form

  function closeOrAbort(next: boolean) {
    if (!next && stream.running) {
      stream.abort()
    }

    onOpenChange(next)
  }

  if (isMobile) {
    return (
      <Sheet onOpenChange={closeOrAbort} open={open}>
        <SheetContent
          className="max-h-[85dvh] overflow-hidden"
          showClose={false}
          side="bottom"
        >
          <SheetHeader
            className="shrink-0"
            subtitle={t('description')}
            title={t('title')}
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
    <Dialog onOpenChange={closeOrAbort} open={open}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden tablet:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription className="text-content">
            {t('description')}
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
