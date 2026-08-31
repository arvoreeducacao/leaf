'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import { CommentThreadItem } from '@/components/comments/comment-thread-item'
import {
  focusCommentedBlock,
  isAnchorMissing,
  onCommentRequest,
  useBlockIndex,
} from '@/components/comments/comments-bridge'
import { ChatIcon, TargetIcon } from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  addComment,
  editComment,
  loadComments,
  removeComment,
  resolveComment,
} from '@/lib/comment-actions'
import type { CommentsResult, CommentsState } from '@/lib/comment-actions'
import { MAX_COMMENT_LENGTH } from '@/lib/comment-limits'
import { useIsMobile } from '@/shared/hooks/use-mobile'

type Props = Readonly<{
  documentId: string
  initialOpenCount: number
}>

export function CommentsPanel({ documentId, initialOpenCount }: Props) {
  const t = useTranslations('comments')
  const tCommon = useTranslations('common')
  const format = useFormatter()
  const isMobile = useIsMobile()
  const blockIndex = useBlockIndex()
  const composerId = useId()

  const [open, setOpen] = useState(false)
  const [state, setState] = useState<CommentsState | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [anchorId, setAnchorId] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)
  const [status, setStatus] = useState('')
  const [now, setNow] = useState(() => Date.now())

  const composerRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const result = await loadComments(documentId)

    if (result.ok) {
      setNow(Date.now())
      setState(result.state)
    } else {
      setLoadError(result.error)
    }

    setLoading(false)
  }, [documentId])

  useEffect(() => {
    if (!open) {
      return
    }

    void load()
  }, [open, load])

  useEffect(
    () =>
      onCommentRequest((blockId) => {
        setAnchorId(blockId)
        setDraftError(null)
        setOpen(true)
        window.setTimeout(() => composerRef.current?.focus(), 120)
      }),
    [],
  )

  function apply(result: CommentsResult, success: string) {
    if (!result.ok) {
      toast.error(result.error)

      return false
    }

    setState(result.state)
    setStatus(success)

    return true
  }

  async function run(
    action: () => Promise<CommentsResult>,
    success: string,
  ): Promise<boolean> {
    setPending(true)
    const result = await action()
    setPending(false)

    return apply(result, success)
  }

  async function submitDraft() {
    if (draft.trim().length === 0) {
      setDraftError(t('placeholder'))

      return
    }

    setDraftError(null)

    const done = await run(
      () => addComment(documentId, draft, anchorId, null),
      t('added'),
    )

    if (done) {
      setDraft('')
      setAnchorId(null)
      toast.success(t('added'))
    }
  }

  function goToBlock(blockId: string) {
    if (isMobile) {
      setOpen(false)
    }

    focusCommentedBlock(blockId)
  }

  const threads = state?.threads ?? []
  const visibleThreads = showResolved
    ? threads
    : threads.filter((thread) => thread.resolvedAt === null)
  const resolvedCount = threads.length - threads.filter((thread) => thread.resolvedAt === null).length
  const openCount = state?.openCount ?? initialOpenCount
  const canComment = state?.canComment ?? false

  const body = (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
      <span aria-live="polite" className="sr-only">
        {status}
      </span>

      {canComment ? (
        <div className="flex shrink-0 flex-col gap-2">
          <Label htmlFor={composerId}>{t('newLabel')}</Label>
          {anchorId ? (
            <p className="flex items-center gap-2 text-body-small text-content">
              <TargetIcon aria-hidden="true" className="size-4 shrink-0" />
              {t('anchorHint')}
            </p>
          ) : null}
          <Textarea
            aria-describedby={draftError ? `${composerId}-error` : undefined}
            aria-invalid={draftError ? true : undefined}
            className="max-w-full"
            disabled={pending}
            id={composerId}
            maxLength={MAX_COMMENT_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('placeholder')}
            ref={composerRef}
            value={draft}
          />
          {draftError ? (
            <p
              className="text-body-small text-danger"
              id={`${composerId}-error`}
              role="alert"
            >
              {draftError}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 tablet:flex-row tablet:justify-end">
            {draft.length > 0 || anchorId ? (
              <Button
                className="w-full tablet:w-auto"
                disabled={pending}
                onClick={() => {
                  setDraft('')
                  setAnchorId(null)
                  setDraftError(null)
                }}
                size="lg"
                type="button"
                variant="secondary"
              >
                {t('cancelDraft')}
              </Button>
            ) : null}
            <Button
              aria-busy={pending}
              className="w-full tablet:w-auto"
              data-testid="submit-comment"
              disabled={pending || draft.trim().length === 0}
              onClick={() => void submitDraft()}
              size="lg"
              type="button"
            >
              {t('submit')}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-body-small text-content">{t('readOnlyHint')}</p>
      )}

      {resolvedCount > 0 ? (
        <div className="flex shrink-0 items-center justify-between gap-3">
          <Label
            className="text-body-small text-content"
            htmlFor={`${composerId}-resolved`}
          >
            {t('showResolved')}
          </Label>
          <Switch
            checked={showResolved}
            id={`${composerId}-resolved`}
            onCheckedChange={setShowResolved}
          />
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-2" data-testid="comments-loading">
          <span className="sr-only">{t('loading')}</span>
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : null}

      {loadError ? (
        <div className="flex flex-col items-start gap-2" role="alert">
          <p className="text-body-small text-danger">{loadError}</p>
          <Button
            onClick={() => void load()}
            size="lg"
            type="button"
            variant="secondary"
          >
            {tCommon('tryAgain')}
          </Button>
        </div>
      ) : null}

      {!loading && !loadError && visibleThreads.length === 0 ? (
        <div className="flex flex-col gap-2 py-6 text-center">
          <ChatIcon
            aria-hidden="true"
            className="mx-auto size-8 text-content-muted"
          />
          <p className="font-bold text-body-medium text-content-strong">
            {t('empty')}
          </p>
          <p className="text-body-small text-content">
            {canComment ? t('emptyHint') : t('emptyReadOnly')}
          </p>
        </div>
      ) : null}

      {!loading && !loadError && visibleThreads.length > 0 && state ? (
        <ul
          aria-label={t('threadListLabel')}
          className="flex flex-col gap-3"
          data-testid="comment-threads"
        >
          {visibleThreads.map((thread) => (
            <CommentThreadItem
              anchorMissing={isAnchorMissing(blockIndex, thread.blockId)}
              canComment={state.canComment}
              canResolveAny={state.canResolveAny}
              formatExact={(at) =>
                format.dateTime(new Date(at), {
                  dateStyle: 'long',
                  timeStyle: 'short',
                })
              }
              formatWhen={(at) => format.relativeTime(new Date(at), now)}
              key={thread.id}
              onDelete={async (commentId) => {
                if (
                  await run(
                    () => removeComment(documentId, commentId),
                    t('removed'),
                  )
                ) {
                  toast.success(t('removed'))
                }
              }}
              onEdit={(commentId, value) =>
                run(
                  () => editComment(documentId, commentId, value),
                  t('updated'),
                )
              }
              onGoToBlock={goToBlock}
              onReply={(threadId, value) =>
                run(
                  () => addComment(documentId, value, null, threadId),
                  t('added'),
                )
              }
              onResolve={async (threadId, resolved) => {
                if (
                  await run(
                    () => resolveComment(documentId, threadId, resolved),
                    resolved ? t('resolvedToast') : t('reopenedToast'),
                  )
                ) {
                  toast.success(
                    resolved ? t('resolvedToast') : t('reopenedToast'),
                  )
                }
              }}
              pending={pending}
              thread={thread}
              viewerId={state.viewerId}
            />
          ))}
        </ul>
      ) : null}
    </div>
  )

  return (
    <>
      <Button
        className="h-12"
        data-testid="comments-button"
        onClick={() => setOpen(true)}
        type="button"
        variant="secondary"
      >
        <ChatIcon aria-hidden="true" />
        <span className="sr-only tablet:not-sr-only">{t('open')}</span>
        {openCount > 0 ? (
          <>
            <Badge aria-hidden="true" variant="info">
              {openCount}
            </Badge>
            <span className="sr-only">{t('openCount', { count: openCount })}</span>
          </>
        ) : null}
      </Button>

      <Sheet onOpenChange={setOpen} open={open}>
        <SheetContent
          className={
            isMobile
              ? 'h-[85dvh] pb-[env(safe-area-inset-bottom)]'
              : 'w-full sm:max-w-md'
          }
          data-testid="comments-panel"
          side={isMobile ? 'bottom' : 'right'}
        >
          <SheetHeader className="shrink-0 gap-2 p-5 pb-0">
            <SheetTitle>{t('title')}</SheetTitle>
            <SheetDescription>{t('description')}</SheetDescription>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    </>
  )
}
