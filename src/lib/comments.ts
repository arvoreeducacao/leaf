import { type SQL, and, asc, count, eq, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import { comments, user } from '@/db/schema'
import { authorNameOf } from '@/lib/author-name'
import { MAX_COMMENT_LENGTH } from '@/lib/comment-limits'

export { MAX_COMMENT_LENGTH }

export type CommentReply = Readonly<{
  id: string
  authorId: string | null
  authorName: string | null
  authorImage: string | null
  body: string
  createdAt: number
  updatedAt: number
}>

export type CommentThread = CommentReply &
  Readonly<{
    blockId: string | null
    resolvedAt: number | null
    replies: ReadonlyArray<CommentReply>
  }>

export type CommentRecord = Readonly<{
  id: string
  documentId: string
  parentId: string | null
  authorId: string | null
  resolvedAt: number | null
}>

export function normalizeCommentBody(body: string) {
  return body.trim().slice(0, MAX_COMMENT_LENGTH)
}

async function commentExists(where: SQL | undefined): Promise<boolean> {
  const rows = await db
    .select({ id: comments.id })
    .from(comments)
    .where(where)
    .limit(1)

  return rows.length > 0
}

export async function getComment(
  documentId: string,
  commentId: string,
): Promise<CommentRecord | null> {
  const rows = await db
    .select({
      id: comments.id,
      documentId: comments.documentId,
      parentId: comments.parentId,
      authorId: comments.authorId,
      resolvedAt: comments.resolvedAt,
    })
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.documentId, documentId)))
    .limit(1)

  const row = rows[0]

  if (!row) {
    return null
  }

  return { ...row, resolvedAt: row.resolvedAt?.getTime() ?? null }
}

export async function listDocumentComments(
  documentId: string,
): Promise<Array<CommentThread>> {
  const rows = await db
    .select({
      id: comments.id,
      parentId: comments.parentId,
      blockId: comments.blockId,
      body: comments.body,
      authorId: comments.authorId,
      authorName: user.name,
      authorEmail: user.email,
      authorImage: user.image,
      resolvedAt: comments.resolvedAt,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
    })
    .from(comments)
    .leftJoin(user, eq(user.id, comments.authorId))
    .where(eq(comments.documentId, documentId))
    .orderBy(asc(comments.createdAt), asc(comments.id))

  const threads = new Map<string, CommentThread & { replies: CommentReply[] }>()

  for (const row of rows) {
    if (row.parentId !== null) {
      continue
    }

    threads.set(row.id, {
      id: row.id,
      authorId: row.authorId,
      authorName: authorNameOf(row.authorName, row.authorEmail),
      authorImage: row.authorImage,
      body: row.body,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
      blockId: row.blockId,
      resolvedAt: row.resolvedAt?.getTime() ?? null,
      replies: [],
    })
  }

  for (const row of rows) {
    if (row.parentId === null) {
      continue
    }

    const thread = threads.get(row.parentId)

    if (!thread) {
      continue
    }

    thread.replies.push({
      id: row.id,
      authorId: row.authorId,
      authorName: authorNameOf(row.authorName, row.authorEmail),
      authorImage: row.authorImage,
      body: row.body,
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    })
  }

  return [...threads.values()].reverse()
}

export async function countOpenComments(documentId: string): Promise<number> {
  const rows = await db
    .select({ total: count() })
    .from(comments)
    .where(
      and(
        eq(comments.documentId, documentId),
        isNull(comments.parentId),
        isNull(comments.resolvedAt),
      ),
    )

  return rows[0]?.total ?? 0
}

type CreateInput = Readonly<{
  documentId: string
  authorId: string
  body: string
  blockId?: string | null
  parentId?: string | null
  now?: Date
}>

export async function createComment(
  input: CreateInput,
): Promise<string | null> {
  const body = normalizeCommentBody(input.body)

  if (body.length === 0) {
    return null
  }

  let blockId = input.blockId ?? null

  if (input.parentId) {
    const parent = await getComment(input.documentId, input.parentId)

    if (!parent || parent.parentId !== null) {
      return null
    }

    blockId = null
  }

  const now = input.now ?? new Date()
  const id = nanoid(12)

  await db.insert(comments).values({
    id,
    documentId: input.documentId,
    parentId: input.parentId ?? null,
    blockId,
    authorId: input.authorId,
    body,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  })

  return id
}

export async function updateCommentBody(
  commentId: string,
  body: string,
  now: Date = new Date(),
): Promise<boolean> {
  const normalized = normalizeCommentBody(body)

  if (normalized.length === 0) {
    return false
  }

  if (!(await commentExists(eq(comments.id, commentId)))) {
    return false
  }

  await db
    .update(comments)
    .set({ body: normalized, updatedAt: now })
    .where(eq(comments.id, commentId))

  return true
}

export async function deleteComment(commentId: string): Promise<boolean> {
  if (!(await commentExists(eq(comments.id, commentId)))) {
    return false
  }

  await db.delete(comments).where(eq(comments.id, commentId))

  return true
}

export async function setCommentResolved(
  commentId: string,
  resolved: boolean,
  now: Date = new Date(),
): Promise<boolean> {
  const target = and(eq(comments.id, commentId), isNull(comments.parentId))

  if (!(await commentExists(target))) {
    return false
  }

  await db
    .update(comments)
    .set({ resolvedAt: resolved ? now : null })
    .where(target)

  return true
}
