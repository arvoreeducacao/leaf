'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { CommentComposer } from '@/components/comments/comment-composer'
import type { CommentViewer } from '@/components/comments/comment-composer'
import { CommentThreadItem } from '@/components/comments/comment-thread-item'
import {
  publishCommentsState,
  useCommentsState,
} from '@/components/comments/comments-store'
import { SlackIcon } from '@/components/icons'
import {
  addComment,
  editComment,
  removeComment,
  resolveComment,
} from '@/lib/comment-actions'
import type { CommentsResult } from '@/lib/comment-actions'
import { pageComments } from '@/lib/comments-state'
import type { CommentsState } from '@/lib/comments-state'
import type { DocumentSlackChannel } from '@/lib/slack/document-channel'

type Props = Readonly<{
  documentId: string
  initialState: CommentsState
  viewer: CommentViewer
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

  const published = useCommentsState(documentId)
  const state = published ?? initialState

  const [pending, setPending] = useState(false)
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
        <CommentComposer
          className="mt-4"
          disabled={pending}
          fieldTestId="document-comment-input"
          label={t('documentNewLabel')}
          onSubmit={(body) =>
            run(() => addComment(documentId, body, null, null), t('added'))
          }
          placeholder={t('documentPlaceholder')}
          submitTestId="submit-document-comment"
          viewer={viewer}
        />
      ) : null}

      {slack?.pushesComments ? (
        <p className="mt-1.5 pl-8 text-caption text-content-muted">
          {t('goesToSlackThread')}
        </p>
      ) : null}
    </section>
  )
}
