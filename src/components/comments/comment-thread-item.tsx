'use client'

import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'

import {
  CheckIcon,
  EditIcon,
  ReplyIcon,
  RotateIcon,
  TargetIcon,
  TrashIcon,
  WarningIcon,
} from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MAX_COMMENT_LENGTH } from '@/lib/comment-limits'
import type { CommentReply, CommentThread } from '@/lib/comments'
import { cn } from '@/shared/utils'

type Props = Readonly<{
  thread: CommentThread
  viewerId: string
  canComment: boolean
  canResolveAny: boolean
  anchorMissing: boolean
  pending: boolean
  formatWhen: (at: number) => string
  formatExact: (at: number) => string
  onGoToBlock: (blockId: string) => void
  onReply: (threadId: string, body: string) => Promise<boolean>
  onEdit: (commentId: string, body: string) => Promise<boolean>
  onDelete: (commentId: string) => Promise<void>
  onResolve: (threadId: string, resolved: boolean) => Promise<void>
}>

function Meta({
  comment,
  formatWhen,
  formatExact,
  unknownAuthor,
  editedLabel,
}: Readonly<{
  comment: CommentReply
  formatWhen: (at: number) => string
  formatExact: (at: number) => string
  unknownAuthor: string
  editedLabel: string
}>) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="font-bold text-body-small text-content-strong">
        {comment.authorName ?? unknownAuthor}
      </span>
      <span
        className="text-body-small text-content"
        title={formatExact(comment.createdAt)}
      >
        {formatWhen(comment.createdAt)}
      </span>
      {comment.updatedAt > comment.createdAt ? (
        <span className="text-body-small text-content">{editedLabel}</span>
      ) : null}
    </div>
  )
}

export function CommentThreadItem({
  thread,
  viewerId,
  canComment,
  canResolveAny,
  anchorMissing,
  pending,
  formatWhen,
  formatExact,
  onGoToBlock,
  onReply,
  onEdit,
  onDelete,
  onResolve,
}: Props) {
  const t = useTranslations('comments')
  const tCommon = useTranslations('common')
  const replyFieldId = useId()
  const editFieldId = useId()

  const [replying, setReplying] = useState(false)
  const [replyBody, setReplyBody] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  const resolved = thread.resolvedAt !== null
  const isThreadAuthor = thread.authorId !== null && thread.authorId === viewerId
  const canResolve = canResolveAny || isThreadAuthor

  function startEdit(comment: CommentReply) {
    setEditingId(comment.id)
    setEditBody(comment.body)
    setConfirmingDelete(null)
  }

  async function submitEdit() {
    if (!editingId) {
      return
    }

    if (await onEdit(editingId, editBody)) {
      setEditingId(null)
      setEditBody('')
    }
  }

  async function submitReply() {
    if (await onReply(thread.id, replyBody)) {
      setReplyBody('')
      setReplying(false)
    }
  }

  function renderBody(comment: CommentReply) {
    if (editingId === comment.id) {
      return (
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor={editFieldId}>
            {t('editLabel')}
          </label>
          <Textarea
            autoFocus
            className="max-w-full"
            disabled={pending}
            id={editFieldId}
            maxLength={MAX_COMMENT_LENGTH}
            onChange={(event) => setEditBody(event.target.value)}
            value={editBody}
          />
          <div className="flex flex-col gap-2 tablet:flex-row tablet:justify-end">
            <Button
              className="w-full tablet:w-auto"
              disabled={pending}
              onClick={() => setEditingId(null)}
              size="lg"
              type="button"
              variant="secondary"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              className="w-full tablet:w-auto"
              disabled={pending || editBody.trim().length === 0}
              onClick={() => void submitEdit()}
              size="lg"
              type="button"
            >
              {t('save')}
            </Button>
          </div>
        </div>
      )
    }

    return (
      <p className="whitespace-pre-wrap break-words text-body-small text-content-strong">
        {comment.body}
      </p>
    )
  }

  function renderActions(comment: CommentReply, isRoot: boolean) {
    const isAuthor = comment.authorId !== null && comment.authorId === viewerId

    if (editingId === comment.id) {
      return null
    }

    if (confirmingDelete === comment.id) {
      return (
        <div className="flex flex-col gap-2 rounded-large bg-surface-subtle p-3">
          <p className="text-body-small text-content-strong">
            {t('deleteConfirm')}
          </p>
          {isRoot && thread.replies.length > 0 ? (
            <p className="text-body-small text-content">{t('deleteHint')}</p>
          ) : null}
          <div className="flex flex-col gap-2 tablet:flex-row tablet:justify-end">
            <Button
              className="w-full tablet:w-auto"
              disabled={pending}
              onClick={() => setConfirmingDelete(null)}
              size="lg"
              type="button"
              variant="secondary"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              className="w-full tablet:w-auto"
              disabled={pending}
              onClick={() => void onDelete(comment.id)}
              size="lg"
              type="button"
              variant="destructive"
            >
              {t('delete')}
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-wrap items-center gap-1">
        {isRoot && canComment && !resolved ? (
          <Button
            disabled={pending}
            onClick={() => setReplying(true)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ReplyIcon aria-hidden="true" />
            {t('reply')}
          </Button>
        ) : null}

        {isAuthor ? (
          <Button
            disabled={pending}
            onClick={() => startEdit(comment)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <EditIcon aria-hidden="true" />
            {t('edit')}
          </Button>
        ) : null}

        {isAuthor ? (
          <Button
            disabled={pending}
            onClick={() => setConfirmingDelete(comment.id)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <TrashIcon aria-hidden="true" />
            {t('delete')}
          </Button>
        ) : null}

        {isRoot && canResolve ? (
          <Button
            disabled={pending}
            onClick={() => void onResolve(thread.id, !resolved)}
            size="sm"
            type="button"
            variant="ghost"
          >
            {resolved ? (
              <RotateIcon aria-hidden="true" />
            ) : (
              <CheckIcon aria-hidden="true" />
            )}
            {resolved ? t('reopen') : t('resolve')}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-3 rounded-large border border-line bg-surface-card p-3',
        resolved && 'bg-surface-subtle',
      )}
      data-resolved={resolved ? 'true' : 'false'}
      data-testid="comment-thread"
      data-thread-id={thread.id}
    >
      <div className="flex flex-wrap items-center gap-2">
        {resolved ? (
          <Badge variant="success">
            <CheckIcon aria-hidden="true" />
            {t('resolvedBadge')}
          </Badge>
        ) : null}

        {thread.blockId === null ? (
          <span className="text-body-small text-content">{t('noAnchor')}</span>
        ) : anchorMissing ? (
          <Badge
            className="gap-1"
            data-testid="comment-unanchored"
            title={t('unanchoredHint')}
            variant="warning"
          >
            <WarningIcon aria-hidden="true" />
            {t('unanchored')}
            <span className="sr-only">{t('unanchoredHint')}</span>
          </Badge>
        ) : (
          <Button
            className="h-auto min-h-11 px-2 py-1 tablet:min-h-0"
            data-testid="comment-anchor"
            onClick={() => onGoToBlock(thread.blockId as string)}
            size="sm"
            type="button"
            variant="ghost"
          >
            <TargetIcon aria-hidden="true" />
            {t('anchorHint')}
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Meta
          comment={thread}
          editedLabel={t('edited')}
          formatExact={formatExact}
          formatWhen={formatWhen}
          unknownAuthor={t('unknownAuthor')}
        />
        {renderBody(thread)}
        {renderActions(thread, true)}
      </div>

      {thread.replies.length > 0 ? (
        <ul className="flex flex-col gap-3 border-line-muted border-l-2 pl-3">
          {thread.replies.map((reply) => (
            <li className="flex flex-col gap-2" key={reply.id}>
              <Meta
                comment={reply}
                editedLabel={t('edited')}
                formatExact={formatExact}
                formatWhen={formatWhen}
                unknownAuthor={t('unknownAuthor')}
              />
              {renderBody(reply)}
              {renderActions(reply, false)}
            </li>
          ))}
        </ul>
      ) : null}

      {replying ? (
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor={replyFieldId}>
            {t('replyLabel', {
              name: thread.authorName ?? t('unknownAuthor'),
            })}
          </label>
          <Textarea
            autoFocus
            className="max-w-full"
            disabled={pending}
            id={replyFieldId}
            maxLength={MAX_COMMENT_LENGTH}
            onChange={(event) => setReplyBody(event.target.value)}
            placeholder={t('replyPlaceholder')}
            value={replyBody}
          />
          <div className="flex flex-col gap-2 tablet:flex-row tablet:justify-end">
            <Button
              className="w-full tablet:w-auto"
              disabled={pending}
              onClick={() => {
                setReplying(false)
                setReplyBody('')
              }}
              size="lg"
              type="button"
              variant="secondary"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              className="w-full tablet:w-auto"
              disabled={pending || replyBody.trim().length === 0}
              onClick={() => void submitReply()}
              size="lg"
              type="button"
            >
              {t('sendReply')}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  )
}
