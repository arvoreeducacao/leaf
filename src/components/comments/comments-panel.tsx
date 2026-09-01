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
  const [anchorId, setAnchorId] = useState<string | null>(null)
  const [showResolved, setShowResolved] = useState(false)
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
        setOpen(true)
        window.setTimeout(() => composerRef.current?.focus(), 120)
      }),
    [],
  )

  async function run(
    action: () => Promise<CommentsResult>,
    success: string,
  ): Promise<boolean> {
    setPending(true)
    const result = await action()
    setPending(false)

    if (!result.ok) {
      toast.error(result.error)

      return false
    }

    setState(result.state)
    toast.success(success)

    return true
  }

  async function submitDraft() {
    const done = await run(
      () => addComment(documentId, draft, anchorId, null),
      t('added'),
    )

    if (done) {
      setDraft('')
      setAnchorId(null)
    }
  }

  function goToBlock(blockId: string) {
    setOpen(false)
    window.setTimeout(() => focusCommentedBlock(blockId), 320)
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
      {!state && loading ? (
        <Skeleton className="h-24 w-full shrink-0" />
      ) : null}

      {state && canComment ? (
        <div className="flex shrink-0 flex-col gap-2">
          <Label htmlFor={composerId}>{t('newLabel')}</Label>
          {anchorId ? (
            <p className="flex items-center gap-2 text-body-small text-content">
              <TargetIcon aria-hidden="true" className="size-4 shrink-0" />
              {t('anchorPending')}
            </p>
          ) : null}
          <Textarea
            className="max-w-full"
            disabled={pending}
            id={composerId}
            maxLength={MAX_COMMENT_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t('placeholder')}
            ref={composerRef}
            value={draft}
          />
          <div className="flex flex-col gap-2 tablet:flex-row tablet:justify-end">
            {draft.length > 0 || anchorId ? (
              <Button
                className="w-full tablet:w-auto"
                disabled={pending}
                onClick={() => {
                  setDraft('')
                  setAnchorId(null)
                }}
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
              type="button"
            >
              {t('submit')}
            </Button>
          </div>
        </div>
      ) : null}

      {state && !canComment ? (
        <p className="text-body-small text-content">{t('readOnlyHint')}</p>
      ) : null}

      {resolvedCount > 0 ? (
        <div className="flex shrink-0 items-center justify-between gap-3">
          <Label
            className="min-h-11 flex-1 cursor-pointer items-center text-content"
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
          <Button onClick={() => void load()} type="button" variant="secondary">
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
            {resolvedCount > 0 ? t('emptyResolvedOnly') : t('empty')}
          </p>
          <p className="text-body-small text-content">
            {resolvedCount > 0
              ? t('emptyResolvedHint')
              : canComment
                ? t('emptyHint')
                : t('emptyReadOnly')}
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
                await run(
                  () => removeComment(documentId, commentId),
                  t('removed'),
                )
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
                await run(
                  () => resolveComment(documentId, threadId, resolved),
                  resolved ? t('resolvedToast') : t('reopenedToast'),
                )
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
        data-testid="comments-button"
        onClick={() => {
          setAnchorId(null)
          setOpen(true)
        }}
        size="sm"
        type="button"
        variant="ghost"
      >
        <ChatIcon aria-hidden="true" />
        <span className="sr-only">{t('open')}</span>
        {openCount > 0 ? (
          <>
            <span aria-hidden="true" className="text-caption tabular-nums">
              {openCount}
            </span>
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
          showClose={!isMobile}
          side={isMobile ? 'bottom' : 'right'}
        >
          {isMobile ? (
            <SheetHeader
              className="shrink-0"
              subtitle={t('description')}
              title={t('title')}
              type="close"
            />
          ) : (
            <SheetHeader className="shrink-0 gap-2 p-5 pb-0">
              <SheetTitle>{t('title')}</SheetTitle>
              <SheetDescription>{t('description')}</SheetDescription>
            </SheetHeader>
          )}
          {body}
        </SheetContent>
      </Sheet>
    </>
  )
}
