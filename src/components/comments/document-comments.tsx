'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useId, useState } from 'react'
import { toast } from 'sonner'

import { CommentThreadItem } from '@/components/comments/comment-thread-item'
import {
  publishCommentsState,
  useCommentsState,
} from '@/components/comments/comments-store'
import { CaretUpCircleIcon, SlackIcon } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/ui/user-avatar'
import {
  addComment,
  editComment,
  removeComment,
  resolveComment,
} from '@/lib/comment-actions'
import type { CommentsResult } from '@/lib/comment-actions'
import { MAX_COMMENT_LENGTH } from '@/lib/comment-limits'
import { pageComments } from '@/lib/comments-state'
import type { CommentsState } from '@/lib/comments-state'
import type { DocumentSlackChannel } from '@/lib/slack/document-channel'

type Props = Readonly<{
  documentId: string
  initialState: CommentsState
  viewer: Readonly<{ id: string; name: string; image: string | null }>
  slack: DocumentSlackChannel | null
  renderedAt: number
}>

export function DocumentComments({
  documentId,
  initialState,
  viewer,
  slack,
  renderedAt,
}: Props) {
  const t = useTranslations('comments')
  const format = useFormatter()
  const composerId = useId()

  const published = useCommentsState(documentId)
  const state = published ?? initialState

  const [pending, setPending] = useState(false)
  const [draft, setDraft] = useState('')
  const [now, setNow] = useState(renderedAt)

  useEffect(() => {
    setNow(Date.now())
  }, [])

  useEffect(() => {
    if (published === null) {
      publishCommentsState(documentId, initialState)
    }
  }, [documentId, initialState, published])

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

    setNow(Date.now())
    publishCommentsState(documentId, result.state)
    toast.success(success)

    return true
  }

  async function submitDraft() {
    if (await run(() => addComment(documentId, draft, null, null), t('added'))) {
      setDraft('')
    }
  }

  function growComposer(field: HTMLTextAreaElement) {
    field.style.height = 'auto'
    field.style.height = `${field.scrollHeight}px`
  }

  const threads = pageComments(state)
  const canComment = state.canComment
  const empty = threads.length === 0

  if (empty && !canComment) {
    return null
  }

  return (
    <section
      aria-label={t('documentSectionLabel')}
      className="mt-8 px-4 tablet:px-[54px]"
      data-testid="document-comments"
    >
      <div className="flex min-h-6 items-center gap-2 border-line-divider border-t pt-4">
        <h2 className="font-medium text-body-small text-content-muted">
          {t('title')}
        </h2>
        {slack ? (
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {slack.name ? (
              <span className="flex min-w-0 items-center gap-1.5 text-caption text-content-muted">
                <SlackIcon aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">#{slack.name}</span>
              </span>
            ) : null}
            <a
              className="shrink-0 rounded-medium font-medium text-caption text-link underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
              href={slack.url}
              rel="noreferrer"
              target="_blank"
            >
              {t('openInSlack')}
            </a>
          </div>
        ) : null}
      </div>

      {empty ? null : (
        <ul
          aria-label={t('threadListLabel')}
          className="mt-2 flex flex-col gap-4"
          data-testid="document-comment-threads"
        >
          {threads.map((thread) => (
            <CommentThreadItem
              anchorMissing={false}
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
              onGoToBlock={() => undefined}
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
              surface="document"
              thread={thread}
              viewerId={state.viewerId}
            />
          ))}
        </ul>
      )}

      {canComment ? (
        <div className="mt-4 flex items-start gap-2">
          <UserAvatar
            className="size-6"
            image={viewer.image}
            name={viewer.name}
            userId={viewer.id}
          />
          <label className="sr-only" htmlFor={composerId}>
            {t('documentNewLabel')}
          </label>
          <textarea
            className="min-h-6 flex-1 resize-none bg-transparent py-0.5 text-body-small text-content-strong outline-none placeholder:text-content-muted"
            data-testid="document-comment-input"
            disabled={pending}
            id={composerId}
            maxLength={MAX_COMMENT_LENGTH}
            onChange={(event) => {
              setDraft(event.target.value)
              growComposer(event.target)
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void submitDraft()
              }
            }}
            placeholder={t('documentPlaceholder')}
            rows={1}
            value={draft}
          />
          <Button
            aria-label={t('sendComment')}
            className="size-6 p-0.5 text-content-muted enabled:text-link"
            data-testid="submit-document-comment"
            disabled={pending || draft.trim().length === 0}
            onClick={() => void submitDraft()}
            size="icon"
            title={t('sendComment')}
            type="button"
            variant="ghost"
          >
            <CaretUpCircleIcon aria-hidden="true" className="size-5" />
          </Button>
        </div>
      ) : null}

      {slack?.pushesComments ? (
        <p className="mt-1.5 pl-8 text-caption text-content-muted">
          {t('goesToSlackThread')}
        </p>
      ) : null}
    </section>
  )
}
