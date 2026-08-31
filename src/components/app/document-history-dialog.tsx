'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { DocumentRenderer } from '@/components/editor/document-renderer'
import { ArrowLeftIcon, HistoryIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import type { VersionDetail, VersionSummary } from '@/lib/document-versions'
import {
  loadDocumentVersion,
  loadDocumentVersions,
  restoreDocumentVersion,
} from '@/lib/version-actions'
import { MAX_VERSIONS_PER_DOCUMENT } from '@/lib/version-limits'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { takeSessionFlag, writeSessionFlag } from '@/shared/storage'
import { cn } from '@/shared/utils'

const restoredFlagKey = 'leaf:version-restored'

type Props = Readonly<{
  documentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}>

export function DocumentHistoryDialog({
  documentId,
  open,
  onOpenChange,
}: Props) {
  const t = useTranslations('versions')
  const tCommon = useTranslations('common')
  const format = useFormatter()
  const isMobile = useIsMobile()

  const [versions, setVersions] = useState<Array<VersionSummary> | null>(null)
  const [listError, setListError] = useState<string | null>(null)
  const [loadingList, setLoadingList] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<VersionDetail | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const backRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const lastSelectedRef = useRef<string | null>(null)
  const wasPreviewOnly = useRef(false)

  useEffect(() => {
    if (takeSessionFlag(restoredFlagKey) === documentId) {
      toast.success(t('restored'))
    }
  }, [documentId, t])

  const loadList = useCallback(async () => {
    setLoadingList(true)
    setListError(null)

    const result = await loadDocumentVersions(documentId)

    if (result.ok) {
      setNow(Date.now())
      setVersions(result.versions)
    } else {
      setListError(result.error)
    }

    setLoadingList(false)
  }, [documentId])

  useEffect(() => {
    if (!open) {
      return
    }

    setSelectedId(null)
    setDetail(null)
    setDetailError(null)
    setConfirming(false)
    void loadList()
  }, [open, loadList])

  const openVersion = useCallback(
    async (versionId: string) => {
      lastSelectedRef.current = versionId
      setSelectedId(versionId)
      setConfirming(false)
      setDetail(null)
      setDetailError(null)
      setLoadingDetail(true)

      const result = await loadDocumentVersion(documentId, versionId)

      if (result.ok) {
        setDetail(result.version)
      } else {
        setDetailError(result.error)
      }

      setLoadingDetail(false)
    },
    [documentId],
  )

  const showPreviewOnly = isMobile && selectedId !== null

  useEffect(() => {
    if (showPreviewOnly && !wasPreviewOnly.current) {
      wasPreviewOnly.current = true
      backRef.current?.focus()

      return
    }

    if (!showPreviewOnly && wasPreviewOnly.current) {
      wasPreviewOnly.current = false

      const previous = lastSelectedRef.current

      if (previous) {
        listRef.current
          ?.querySelector<HTMLButtonElement>(
            `[data-version-id="${previous}"]`,
          )
          ?.focus()
      }
    }
  }, [showPreviewOnly])

  async function restore() {
    if (!selectedId) {
      return
    }

    setRestoring(true)
    const result = await restoreDocumentVersion(documentId, selectedId)

    if (!result.ok) {
      setRestoring(false)
      toast.error(result.error)

      return
    }

    writeSessionFlag(restoredFlagKey, documentId)
    onOpenChange(false)
    window.location.reload()
  }

  function labelFor(version: VersionSummary) {
    return format.relativeTime(new Date(version.createdAt), now)
  }

  function absoluteFor(version: VersionSummary) {
    return format.dateTime(new Date(version.createdAt), {
      dateStyle: 'long',
      timeStyle: 'short',
    })
  }

  const hasVersions = Boolean(versions && versions.length > 0)

  const list = (
    <div className="flex min-h-0 flex-1 flex-col gap-3 tablet:max-w-72 tablet:flex-1 tablet:border-line tablet:border-r tablet:pr-4">
      {loadingList ? (
        <div className="flex flex-col gap-2" data-testid="versions-loading">
          <span className="sr-only">{tCommon('loading')}</span>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : null}

      {listError ? (
        <div className="flex flex-col items-start gap-2" role="alert">
          <p className="text-body-small text-danger">{listError}</p>
          <Button
            onClick={() => void loadList()}
            type="button"
            variant="secondary"
          >
            {tCommon('tryAgain')}
          </Button>
        </div>
      ) : null}

      {!loadingList && !listError && versions?.length === 0 ? (
        <div className="flex flex-col gap-2 py-6 text-center">
          <HistoryIcon
            aria-hidden="true"
            className="mx-auto size-8 text-content-muted"
          />
          <p className="font-bold text-body-medium text-content-strong">
            {t('empty')}
          </p>
          <p className="text-body-small text-content">{t('emptyHint')}</p>
        </div>
      ) : null}

      {!loadingList && !listError && hasVersions ? (
        <ul
          aria-label={t('listLabel')}
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto"
          ref={listRef}
        >
          {versions?.map((version, index) => (
            <li key={version.id}>
              <button
                aria-current={selectedId === version.id ? 'true' : undefined}
                className={cn(
                  'flex min-h-11 w-full cursor-pointer flex-col items-start gap-1 rounded-large border-l-2 px-3 py-2 text-left transition-colors',
                  'outline-none focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  selectedId === version.id
                    ? 'border-brand-strong bg-brand-surface'
                    : 'border-transparent hover:bg-surface-hover',
                )}
                data-version-id={version.id}
                disabled={restoring}
                onClick={() => void openVersion(version.id)}
                title={absoluteFor(version)}
                type="button"
              >
                <span
                  className={
                    selectedId === version.id
                      ? 'font-bold text-body-small text-content-strong'
                      : 'text-body-small text-content-strong'
                  }
                >
                  {labelFor(version)}
                  {index === 0 ? (
                    <span className="sr-only"> {t('newest')}</span>
                  ) : null}
                </span>
                <span className="text-body-small text-content">
                  {version.authorName
                    ? t('byAuthor', { name: version.authorName })
                    : t('unknownAuthor')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )

  const preview = (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {isMobile ? (
        <Button
          className="w-fit"
          onClick={() => {
            setSelectedId(null)
            setConfirming(false)
          }}
          ref={backRef}
          type="button"
          variant="ghost"
        >
          <ArrowLeftIcon aria-hidden="true" />
          {t('backToList')}
        </Button>
      ) : null}

      {loadingDetail ? (
        <div className="flex flex-col gap-2">
          <span className="sr-only">{tCommon('loading')}</span>
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : null}

      {detailError ? (
        <p className="text-body-small text-danger" role="alert">
          {detailError}
        </p>
      ) : null}

      {detail ? (
        <>
          <div className="flex flex-col gap-1">
            <h3 className="font-bold text-body-medium text-content-strong">
              {detail.title}
            </h3>
            <p className="text-body-small text-content">
              {format.dateTime(new Date(detail.createdAt), {
                dateStyle: 'long',
                timeStyle: 'short',
              })}
            </p>
            <p className="text-body-small text-content">
              {detail.authorName
                ? t('byAuthor', { name: detail.authorName })
                : t('unknownAuthor')}
            </p>
          </div>

          <div
            aria-label={t('previewLabel')}
            className="min-h-0 flex-1 overflow-y-auto rounded-large border border-line bg-surface-app p-2 outline-none focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
            role="region"
            tabIndex={0}
          >
            <DocumentRenderer content={detail.content} />
          </div>

          {confirming ? (
            <div className="flex flex-col gap-2 rounded-large bg-surface-subtle p-3">
              <p className="text-body-small text-content-strong">
                {t('restoreConfirm')}
              </p>
              <p className="text-body-small text-content">{t('restoreHint')}</p>
              <span aria-live="polite" className="text-body-small text-content">
                {restoring ? tCommon('loading') : ''}
              </span>
              <div className="flex flex-col gap-2 tablet:flex-row tablet:justify-end">
                <Button
                  className="w-full tablet:w-auto"
                  disabled={restoring}
                  onClick={() => setConfirming(false)}
                  type="button"
                  variant="secondary"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  aria-busy={restoring}
                  className="w-full tablet:w-auto"
                  disabled={restoring}
                  onClick={() => void restore()}
                  type="button"
                >
                  {t('restore')}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              className="w-full tablet:w-auto tablet:self-end"
              onClick={() => setConfirming(true)}
              type="button"
            >
              {t('restore')}
            </Button>
          )}
        </>
      ) : null}

      {!detail &&
      !loadingDetail &&
      !detailError &&
      !loadingList &&
      !listError &&
      hasVersions ? (
        <p className="text-body-small text-content">{t('selectPrompt')}</p>
      ) : null}
    </div>
  )

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="flex flex-col tablet:max-w-4xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('description', { max: MAX_VERSIONS_PER_DOCUMENT })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 tablet:flex-row">
          {showPreviewOnly ? null : list}
          {isMobile && !showPreviewOnly ? null : preview}
        </div>
      </DialogContent>
    </Dialog>
  )
}
