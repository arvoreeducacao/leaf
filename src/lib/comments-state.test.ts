import { describe, expect, it } from 'vitest'

import type { CommentsState } from '@/lib/comments-state'
import { pageComments, relativeTimeAnchor } from '@/lib/comments-state'
import type { CommentThread } from '@/lib/comments'

function thread(
  id: string,
  overrides: Partial<CommentThread> = {},
): CommentThread {
  return {
    id,
    authorId: 'user-1',
    authorName: 'Author',
    authorImage: null,
    origin: 'leaf',
    body: id,
    createdAt: 1_000,
    updatedAt: 1_000,
    blockId: null,
    resolvedAt: null,
    replies: [],
    ...overrides,
  }
}

function stateOf(threads: ReadonlyArray<CommentThread>): CommentsState {
  return {
    threads,
    viewerId: 'user-1',
    canComment: true,
    canResolveAny: true,
    openCount: threads.length,
  }
}

describe('pageComments', () => {
  it('keeps only comments that are not anchored to a block', () => {
    const state = stateOf([
      thread('page'),
      thread('anchored', { blockId: 'block-1' }),
    ])

    expect(pageComments(state).map((item) => item.id)).toEqual(['page'])
  })

  it('drops resolved threads', () => {
    const state = stateOf([
      thread('open'),
      thread('done', { resolvedAt: 2_000 }),
    ])

    expect(pageComments(state).map((item) => item.id)).toEqual(['open'])
  })

  it('reads oldest first, the way a conversation is read', () => {
    const state = stateOf([
      thread('third', { createdAt: 3_000 }),
      thread('first', { createdAt: 1_000 }),
      thread('second', { createdAt: 2_000 }),
    ])

    expect(pageComments(state).map((item) => item.id)).toEqual([
      'first',
      'second',
      'third',
    ])
  })

  it('does not mutate the state it receives', () => {
    const threads = [
      thread('second', { createdAt: 2_000 }),
      thread('first', { createdAt: 1_000 }),
    ]

    pageComments(stateOf(threads))

    expect(threads.map((item) => item.id)).toEqual(['second', 'first'])
  })
})

describe('relativeTimeAnchor', () => {
  it('lands on the next whole minute so two renders of the same page agree', () => {
    expect(relativeTimeAnchor(1_788_646_805_123)).toBe(1_788_646_860_000)
    expect(relativeTimeAnchor(1_788_646_859_999)).toBe(1_788_646_860_000)
  })

  it('never sits before a comment written in the same minute', () => {
    const writtenAt = 1_788_646_845_000

    expect(relativeTimeAnchor(writtenAt)).toBeGreaterThanOrEqual(writtenAt)
  })
})
