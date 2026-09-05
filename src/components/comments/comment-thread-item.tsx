'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useId, useState } from 'react'

import {
  CheckIcon,
  EditIcon,
  ReplyIcon,
  RotateIcon,
  SlackIcon,
  TargetIcon,
  TrashIcon,
  WarningIcon,
} from '@/components/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/ui/user-avatar'
import { MAX_COMMENT_LENGTH } from '@/lib/comment-limits'
import type { CommentReply, CommentThread } from '@/lib/comments'
import { cn } from '@/shared/utils'

export type CommentSurface = 'panel' | 'document'

function IconAction({
  label,
  icon,
  disabled,
  onClick,
}: Readonly<{
  label: string
  icon: ReactNode
  disabled: boolean
  onClick: () => void
}>) {
  return (
    <Button
      aria-label={label}
      className="size-6 rounded-medium p-1 text-content-muted"
      disabled={disabled}
      onClick={onClick}
      size="icon"
      title={label}
      type="button"
      variant="ghost"
    >
      {icon}
    </Button>
  )
}

type Props = Readonly<{
  thread: CommentThread
  viewerId: string
  canComment: boolean
  canResolveAny: boolean
  anchorMissing: boolean
  pending: boolean
  surface?: CommentSurface
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
  slackLabel,
  surface,
}: Readonly<{
  comment: CommentReply
  formatWhen: (at: number) => string
  formatExact: (at: number) => string
  unknownAuthor: string
  editedLabel: string
  slackLabel: string
  surface: CommentSurface
}>) {
  const fromSlack = comment.origin === 'slack'

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1',
        surface === 'document' && 'min-h-6 flex-nowrap gap-x-1.5',
      )}
    >
      {comment.authorId || fromSlack ? (
        <UserAvatar
          className={surface === 'document' ? 'mr-0.5 size-6' : undefined}
          image={comment.authorImage}
          name={comment.authorName ?? unknownAuthor}
          userId={comment.authorId ?? comment.id}
        />
      ) : null}
      <span
        className={cn(
          'text-body-small text-content-strong',
          surface === 'document' ? 'min-w-0 truncate font-medium' : 'font-bold',
        )}
      >
        {comment.authorName ?? unknownAuthor}
      </span>
      {fromSlack ? (
        <Badge variant="info">
          <SlackIcon aria-hidden="true" />
          {slackLabel}
        </Badge>
      ) : null}
      <span
        className={cn(
          'whitespace-nowrap',
          surface === 'document'
            ? 'text-caption text-content-muted'
            : 'text-body-small text-content',
        )}
        suppressHydrationWarning
        title={formatExact(comment.createdAt)}
      >
        {formatWhen(comment.createdAt)}
      </span>
      {comment.updatedAt > comment.createdAt ? (
        <span
          className={cn(
            'whitespace-nowrap',
            surface === 'document'
              ? 'text-caption text-content-muted'
              : 'text-body-small text-content',
          )}
        >
          {editedLabel}
        </span>
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
  surface = 'panel',
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

  const inDocument = surface === 'document'
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
              type="button"
              variant="secondary"
            >
              {tCommon('cancel')}
            </Button>
            <Button
              className="w-full tablet:w-auto"
              disabled={pending || editBody.trim().length === 0}
              onClick={() => void submitEdit()}
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

  function renderDeleteConfirm(comment: CommentReply, isRoot: boolean) {
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
            type="button"
            variant="secondary"
          >
            {tCommon('cancel')}
          </Button>
          <Button
            className="w-full tablet:w-auto"
            disabled={pending}
            onClick={() => void onDelete(comment.id)}
            type="button"
            variant="destructive"
          >
            {t('delete')}
          </Button>
        </div>
      </div>
    )
  }

  function actionsOf(comment: CommentReply, isRoot: boolean) {
    const isAuthor = comment.authorId !== null && comment.authorId === viewerId

    return {
      canDelete: isAuthor,
      canEditBody: isAuthor,
      canReply: isRoot && canComment && !resolved,
      canToggleResolved: isRoot && canResolve,
    }
  }

  function renderActions(comment: CommentReply, isRoot: boolean) {
    if (editingId === comment.id) {
      return null
    }

    if (confirmingDelete === comment.id) {
      return renderDeleteConfirm(comment, isRoot)
    }

    const allowed = actionsOf(comment, isRoot)

    return (
      <div className="flex flex-wrap items-center gap-1">
        {allowed.canReply ? (
          <Button
            className="h-auto min-h-11 px-2 py-1 tablet:min-h-0"
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

        {allowed.canEditBody ? (
          <Button
            className="h-auto min-h-11 px-2 py-1 tablet:min-h-0"
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

        {allowed.canDelete ? (
          <Button
            className="h-auto min-h-11 px-2 py-1 tablet:min-h-0"
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

        {allowed.canToggleResolved ? (
          <Button
            className="h-auto min-h-11 px-2 py-1 tablet:min-h-0"
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

  function renderHoverActions(comment: CommentReply, isRoot: boolean) {
    if (editingId === comment.id || confirmingDelete === comment.id) {
      return null
    }

    const allowed = actionsOf(comment, isRoot)

    if (
      !(
        allowed.canReply ||
        allowed.canEditBody ||
        allowed.canDelete ||
        allowed.canToggleResolved
      )
    ) {
      return null
    }

    return (
      <div className="ml-auto flex shrink-0 items-center gap-1 opacity-100 transition-opacity tablet:opacity-0 tablet:group-focus-within/comment:opacity-100 tablet:group-hover/comment:opacity-100">
        {allowed.canReply ? (
          <IconAction
            disabled={pending}
            icon={<ReplyIcon aria-hidden="true" />}
            label={t('reply')}
            onClick={() => setReplying(true)}
          />
        ) : null}
        {allowed.canEditBody ? (
          <IconAction
            disabled={pending}
            icon={<EditIcon aria-hidden="true" />}
            label={t('edit')}
            onClick={() => startEdit(comment)}
          />
        ) : null}
        {allowed.canDelete ? (
          <IconAction
            disabled={pending}
            icon={<TrashIcon aria-hidden="true" />}
            label={t('delete')}
            onClick={() => setConfirmingDelete(comment.id)}
          />
        ) : null}
        {allowed.canToggleResolved ? (
          <IconAction
            disabled={pending}
            icon={
              resolved ? (
                <RotateIcon aria-hidden="true" />
              ) : (
                <CheckIcon aria-hidden="true" />
              )
            }
            label={resolved ? t('reopen') : t('resolve')}
            onClick={() => void onResolve(thread.id, !resolved)}
          />
        ) : null}
      </div>
    )
  }

  function renderReplyForm(compact: boolean) {
    return (
      <div className={cn('flex flex-col gap-2', compact && 'pl-8')}>
        <label className="sr-only" htmlFor={replyFieldId}>
          {t('replyLabel', { name: thread.authorName ?? t('unknownAuthor') })}
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
            type="button"
            variant="secondary"
          >
            {tCommon('cancel')}
          </Button>
          <Button
            className="w-full tablet:w-auto"
            disabled={pending || replyBody.trim().length === 0}
            onClick={() => void submitReply()}
            type="button"
          >
            {t('sendReply')}
          </Button>
        </div>
      </div>
    )
  }

  function renderDocumentEntry(comment: CommentReply, isRoot: boolean) {
    return (
      <div className="group/comment flex flex-col" key={comment.id}>
        <div className="flex items-center gap-1.5">
          <Meta
            comment={comment}
            editedLabel={t('edited')}
            formatExact={formatExact}
            formatWhen={formatWhen}
            slackLabel={t('fromSlack')}
            surface="document"
            unknownAuthor={t('unknownAuthor')}
          />
          {renderHoverActions(comment, isRoot)}
        </div>
        <div className="pt-1 pl-8">
          {confirmingDelete === comment.id
            ? renderDeleteConfirm(comment, isRoot)
            : renderBody(comment)}
        </div>
      </div>
    )
  }

  if (inDocument) {
    return (
      <li
        className="flex flex-col gap-2"
        data-resolved={resolved ? 'true' : 'false'}
        data-testid="document-comment-thread"
        data-thread-id={thread.id}
      >
        {renderDocumentEntry(thread, true)}
        {thread.replies.map((reply) => renderDocumentEntry(reply, false))}
        {replying ? renderReplyForm(true) : null}
      </li>
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
          slackLabel={t('fromSlack')}
          surface="panel"
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
                slackLabel={t('fromSlack')}
                surface="panel"
                unknownAuthor={t('unknownAuthor')}
              />
              {renderBody(reply)}
              {renderActions(reply, false)}
            </li>
          ))}
        </ul>
      ) : null}

      {replying ? renderReplyForm(false) : null}
    </li>
  )
}
