import type { CommentThread } from '@/lib/comments'

export type CommentsState = Readonly<{
  threads: ReadonlyArray<CommentThread>
  viewerId: string
  canComment: boolean
  canResolveAny: boolean
  openCount: number
}>

export function pageComments(
  state: CommentsState,
): ReadonlyArray<CommentThread> {
  const open = state.threads.filter(
    (thread) => thread.blockId === null && thread.resolvedAt === null,
  )

  return [...open].sort((left, right) => left.createdAt - right.createdAt)
}

const RELATIVE_TIME_STEP_MS = 60_000

export function relativeTimeAnchor(at: number = Date.now()): number {
  return Math.ceil(at / RELATIVE_TIME_STEP_MS) * RELATIVE_TIME_STEP_MS
}
