'use server'

import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'

import { getSession } from '@/lib/auth'
import { authorNameOf } from '@/lib/author-name'
import type { AccessLevel } from '@/lib/authz'
import {
  canComment,
  canEdit,
  getDocumentAccess,
  registerCommentAttempt,
} from '@/lib/authz'
import {
  countOpenComments,
  createComment,
  deleteComment,
  getComment,
  listDocumentComments,
  normalizeCommentBody,
  setCommentResolved,
  updateCommentBody,
} from '@/lib/comments'
import type { CommentThread } from '@/lib/comments'
import { pushCommentToThread, reactOnComment } from '@/lib/slack/sync'

export type CommentsState = Readonly<{
  threads: ReadonlyArray<CommentThread>
  viewerId: string
  canComment: boolean
  canResolveAny: boolean
  openCount: number
}>

export type CommentsResult =
  | { ok: true; state: CommentsState }
  | { ok: false; error: string }

async function message(key: string) {
  return (await getTranslations('errors'))(key)
}

async function readState(
  documentId: string,
  access: AccessLevel,
  viewerId: string,
): Promise<CommentsResult> {
  return {
    ok: true,
    state: {
      threads: await listDocumentComments(documentId),
      viewerId,
      canComment: canComment(access),
      canResolveAny: canEdit(access),
      openCount: await countOpenComments(documentId),
    },
  }
}

async function requireAccess(documentId: string) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  const access = await getDocumentAccess(documentId, session)

  if (!access) {
    return { ok: false as const, error: await message('notAllowed') }
  }

  return { ok: true as const, session, access }
}

export async function loadComments(
  documentId: string,
): Promise<CommentsResult> {
  const guard = await requireAccess(documentId)

  if (!guard.ok) {
    return guard
  }

  return readState(documentId, guard.access, guard.session.user.id)
}

export async function addComment(
  documentId: string,
  body: string,
  blockId: string | null,
  parentId: string | null,
): Promise<CommentsResult> {
  const guard = await requireAccess(documentId)

  if (!guard.ok) {
    return guard
  }

  if (!canComment(guard.access)) {
    return { ok: false, error: await message('notAllowed') }
  }

  if (normalizeCommentBody(body).length === 0) {
    return { ok: false, error: await message('commentEmpty') }
  }

  const decision = registerCommentAttempt(
    `${documentId}:${guard.session.user.id}`,
  )

  if (!decision.allowed) {
    return { ok: false, error: await message('commentTooFast') }
  }

  const created = await createComment({
    documentId,
    authorId: guard.session.user.id,
    body,
    blockId,
    parentId,
  })

  if (!created) {
    return { ok: false, error: await message('commentNotFound') }
  }

  await pushCommentToThread({
    authorImage: guard.session.user.image ?? null,
    authorName: authorNameOf(guard.session.user.name, guard.session.user.email),
    body: normalizeCommentBody(body),
    documentId,
  })

  return readState(documentId, guard.access, guard.session.user.id)
}

export async function editComment(
  documentId: string,
  commentId: string,
  body: string,
): Promise<CommentsResult> {
  const guard = await requireAccess(documentId)

  if (!guard.ok) {
    return guard
  }

  const comment = await getComment(documentId, commentId)

  if (!comment) {
    return { ok: false, error: await message('commentNotFound') }
  }

  if (comment.authorId !== guard.session.user.id) {
    return { ok: false, error: await message('notAllowed') }
  }

  if (!(await updateCommentBody(commentId, body))) {
    return { ok: false, error: await message('commentEmpty') }
  }

  return readState(documentId, guard.access, guard.session.user.id)
}

export async function removeComment(
  documentId: string,
  commentId: string,
): Promise<CommentsResult> {
  const guard = await requireAccess(documentId)

  if (!guard.ok) {
    return guard
  }

  const comment = await getComment(documentId, commentId)

  if (!comment) {
    return { ok: false, error: await message('commentNotFound') }
  }

  if (comment.authorId !== guard.session.user.id) {
    return { ok: false, error: await message('notAllowed') }
  }

  await deleteComment(commentId)

  return readState(documentId, guard.access, guard.session.user.id)
}

export async function resolveComment(
  documentId: string,
  commentId: string,
  resolved: boolean,
): Promise<CommentsResult> {
  const guard = await requireAccess(documentId)

  if (!guard.ok) {
    return guard
  }

  const comment = await getComment(documentId, commentId)

  if (!comment || comment.parentId !== null) {
    return { ok: false, error: await message('commentNotFound') }
  }

  const isAuthor = comment.authorId === guard.session.user.id

  if (!isAuthor && !canEdit(guard.access)) {
    return { ok: false, error: await message('notAllowed') }
  }

  await setCommentResolved(commentId, resolved)

  if (comment.externalId) {
    await reactOnComment({
      documentId,
      externalId: comment.externalId,
      resolved,
    })
  }

  return readState(documentId, guard.access, guard.session.user.id)
}
