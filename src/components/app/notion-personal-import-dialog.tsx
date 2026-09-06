'use client'

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { notionConnectHref } from '@/components/app/notion-import-params'
import {
  openCommandPalette,
  requestDocumentImport,
  useImportAvailability,
} from '@/components/app/palette-bridge'
import { ImportProgress } from '@/components/editor/import-progress'
import { useImportStream } from '@/components/editor/use-import-stream'
import { AlertIcon, CheckCircleIcon } from '@/components/icons'
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
import { notionPersonalImportState } from '@/lib/import-actions'
import type { NotionPersonalImportState } from '@/lib/import-actions'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = Readonly<{
  open: boolean
  returnPath: string
  connectFailed: boolean
  onOpenChange: (open: boolean) => void
}>

function connectHref(returnPath: string) {
  return notionConnectHref(returnPath, 'personal')
}

export function NotionPersonalImportDialog({
  open,
  returnPath,
  connectFailed,
  onOpenChange,
}: Props) {
  const t = useTranslations('notionImport')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const isMobile = useIsMobile()
  const importAvailable = useImportAvailability()
  const stream = useImportStream()
  const { reset, running, started, summary } = stream
  const [connection, setConnection] = useState<NotionPersonalImportState | null>(
    null,
  )
  const announced = useRef<typeof summary>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    if (!running) {
      reset()
    }

    let active = true

    void notionPersonalImportState().then((state) => {
      if (active) {
        setConnection(state)
      }
    })

    return () => {
      active = false
    }
  }, [open, reset, running])

  useEffect(() => {
    if (!summary || announced.current === summary) {
      return
    }

    announced.current = summary

    if (summary.pages > 0) {
      toast.success(t('doneToast', { count: summary.pages }), {
        action: {
          label: t('open'),
          onClick: () => router.push('/documents?scope=private'),
        },
      })
    } else if (!summary.alreadyImportedCount) {
      toast.message(t('doneNothing'))
    }
  }, [router, summary, t])

  function begin(skipAlreadyImported: boolean) {
    void stream.start(
      '/api/import/notion/link',
      JSON.stringify({
        destination: 'private',
        skipAlreadyImported,
        workspace: true,
      }),
      { 'Content-Type': 'application/json' },
    )
  }

  function handleOpenChange(next: boolean) {
    if (!next && running) {
      toast.message(t('backgroundHint'))
    }

    onOpenChange(next)
  }

  function importZip() {
    onOpenChange(false)

    if (importAvailable) {
      requestDocumentImport()

      return
    }

    openCommandPalette()
  }

  const benefits = (
    <ul className="flex flex-col gap-2">
      {(['benefitHierarchy', 'benefitDuplicates'] as const).map((key) => (
        <li
          className="flex items-start gap-2 text-body-small text-content"
          key={key}
        >
          <CheckCircleIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-content-subtle"
          />
          {t(key)}
        </li>
      ))}
    </ul>
  )

  const alreadyImported =
    summary && summary.alreadyImportedCount ? (
      <div className="flex flex-col gap-2 rounded-large bg-surface-subtle p-4">
        <p className="font-bold text-body-small text-content-strong">
          {t('alreadyImported', { count: summary.alreadyImportedCount })}
        </p>
        <p className="text-body-small text-content">{t('alreadyImportedHint')}</p>
        {summary.alreadyImported && summary.alreadyImported.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {summary.alreadyImported.map((document) => (
              <li key={document.documentId}>
                <Link
                  className="text-body-small text-brand underline-offset-2 hover:underline"
                  href={`/doc/${document.documentId}`}
                  onClick={() => onOpenChange(false)}
                >
                  {document.title || t('untitledPage')}
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        <div>
          <Button
            onClick={() => begin(false)}
            size="sm"
            type="button"
            variant="secondary"
          >
            {t('importAsCopies')}
          </Button>
        </div>
      </div>
    ) : null

  const form =
    connection === null ? (
      <p className="text-body-small text-content">{t('checking')}</p>
    ) : connection.state === 'unavailable' ? (
      <div className="flex flex-col gap-3">
        <p className="font-bold text-body-small text-content-strong">
          {t('unavailableTitle')}
        </p>
        <p className="text-body-small text-content">{t('unavailable')}</p>
      </div>
    ) : (
      <div className="flex flex-col gap-4">
        {benefits}
        {connectFailed ? (
          <p
            className="flex items-start gap-2 text-body-small text-danger"
            role="alert"
          >
            <AlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {t('failedConnect')}
          </p>
        ) : null}
        {connection.state === 'connected' ? (
          <p className="flex flex-wrap items-center gap-x-2 text-body-small text-content">
            <span className="flex items-center gap-1.5 text-content-strong">
              <CheckCircleIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-positive"
              />
              {connection.workspaceName
                ? t('connectedTo', { workspace: connection.workspaceName })
                : t('connected')}
            </span>
            <a
              className="text-brand underline-offset-2 hover:underline"
              href={connectHref(returnPath)}
            >
              {t('reconnect')}
            </a>
          </p>
        ) : null}
      </div>
    )

  const content = started ? (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <ImportProgress stream={stream} />
      {alreadyImported}
    </div>
  ) : (
    form
  )

  const zipLink = (
    <button
      className="text-left text-body-small text-brand underline-offset-2 hover:underline"
      onClick={importZip}
      type="button"
    >
      {t('zipHint')}
    </button>
  )

  const actions = started ? (
    <div className="flex flex-col gap-2 tablet:flex-row-reverse">
      {running ? (
        <>
          <Button
            className="w-full tablet:w-auto"
            onClick={() => handleOpenChange(false)}
            type="button"
            variant="secondary"
          >
            {t('background')}
          </Button>
          <Button
            className="w-full tablet:w-auto"
            onClick={stream.abort}
            type="button"
            variant="ghost"
          >
            {t('cancelImport')}
          </Button>
        </>
      ) : (
        <Button
          className="w-full tablet:w-auto"
          onClick={() => onOpenChange(false)}
          type="button"
        >
          {tCommon('close')}
        </Button>
      )}
    </div>
  ) : connection === null ? null : connection.state === 'unavailable' ? (
    <div className="flex flex-col gap-2 tablet:flex-row-reverse">
      <Button className="w-full tablet:w-auto" onClick={importZip} type="button">
        {t('zipAction')}
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
  ) : (
    <div className="flex flex-col gap-2 tablet:flex-row-reverse tablet:items-center">
      {connection.state === 'connected' ? (
        <Button
          className="w-full tablet:w-auto"
          onClick={() => begin(true)}
          type="button"
        >
          {t('start')}
        </Button>
      ) : (
        <Button asChild className="w-full tablet:w-auto">
          <a href={connectHref(returnPath)}>{t('connect')}</a>
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
      <span className="tablet:mr-auto">{zipLink}</span>
    </div>
  )

  const title = started ? t('progressTitle') : t('title')
  const description = started ? null : t('description')

  if (isMobile) {
    return (
      <Sheet onOpenChange={handleOpenChange} open={open}>
        <SheetContent
          className="max-h-[85dvh] overflow-hidden"
          showClose={false}
          side="bottom"
        >
          <SheetHeader
            className="shrink-0"
            subtitle={description ?? undefined}
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
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="flex max-h-[85dvh] flex-col overflow-hidden tablet:max-w-lg">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-content">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {content}
        {actions ? (
          <DialogFooter className="shrink-0">{actions}</DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
