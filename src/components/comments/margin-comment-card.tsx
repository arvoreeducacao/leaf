'use client'

import { useTranslations } from 'next-intl'
import type { Ref } from 'react'

import { CommentComposer } from '@/components/comments/comment-composer'
import type { CommentViewer } from '@/components/comments/comment-composer'
import { CommentThreadItem } from '@/components/comments/comment-thread-item'
import type { CommentThread } from '@/lib/comments'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  thread: CommentThread
  viewer: CommentViewer
  viewerId: string
  canComment: boolean
  canResolveAny: boolean
  pending: boolean
  active: boolean
  top: number
  width: number
  cardRef: Ref<HTMLDivElement>
  onActivate: () => void
  formatWhen: (at: number) => string
  formatExact: (at: number) => string
  onReply: (threadId: string, body: string) => Promise<boolean>
  onEdit: (commentId: string, body: string) => Promise<boolean>
  onDelete: (commentId: string) => Promise<void>
  onResolve: (threadId: string, resolved: boolean) => Promise<void>
}>

export function MarginCommentCard({
  thread,
  viewer,
  viewerId,
  canComment,
  canResolveAny,
  pending,
  active,
  top,
  width,
  cardRef,
  onActivate,
  formatWhen,
  formatExact,
  onReply,
  onEdit,
  onDelete,
  onResolve,
}: Props) {
  const t = useTranslations('comments')

  const authorName = thread.authorName ?? t('unknownAuthor')

  return (
    <div
      className={cn(
        'pointer-events-auto absolute rounded-xlarge border border-line-divider bg-surface-card py-1 transition-[transform,box-shadow] duration-150',
        active ? '-translate-x-5 shadow-float' : 'hover:-translate-x-[5px]',
      )}
      data-active={active ? 'true' : 'false'}
      data-testid="margin-comment-card"
      data-thread-id={thread.id}
      onFocusCapture={onActivate}
      onMouseDown={onActivate}
      ref={cardRef}
      style={{ top, width }}
    >
      <ul aria-label={t('threadListLabel')} className="flex flex-col">
        <CommentThreadItem
          anchorMissing={false}
          canComment={canComment}
          canResolveAny={canResolveAny}
          formatExact={formatExact}
          formatWhen={formatWhen}
          onDelete={onDelete}
          onEdit={onEdit}
          onGoToBlock={() => undefined}
          onReply={onReply}
          onResolve={onResolve}
          pending={pending}
          surface="margin"
          thread={thread}
          viewerId={viewerId}
        />
      </ul>
      {active && canComment && thread.resolvedAt === null ? (
        <CommentComposer
          autoFocus
          className="px-3 pt-1 pb-2"
          disabled={pending}
          fieldTestId="margin-comment-input"
          label={t('replyLabel', { name: authorName })}
          onSubmit={(body) => onReply(thread.id, body)}
          placeholder={t('replyPlaceholder')}
          submitTestId="submit-margin-comment"
          viewer={viewer}
        />
      ) : null}
    </div>
  )
}
