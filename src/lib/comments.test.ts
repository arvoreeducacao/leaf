import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { db } from '@/db'
import { comments, documents, user } from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { MAX_COMMENT_LENGTH } from '@/lib/comment-limits'
import {
  countOpenComments,
  createComment,
  deleteComment,
  getComment,
  listDocumentComments,
  setCommentResolved,
  updateCommentBody,
} from '@/lib/comments'

const author = { id: 'user-author', email: 'author@arvore.com.br' }
const guest = { id: 'user-guest', email: 'guest@arvore.com.br' }

async function seedComment(
  body: string,
  options: Readonly<{
    documentId?: string
    authorId?: string
    blockId?: string | null
    parentId?: string | null
    at?: number
  }> = {},
) {
  return createComment({
    documentId: options.documentId ?? 'doc-a',
    authorId: options.authorId ?? author.id,
    body,
    blockId: options.blockId ?? null,
    parentId: options.parentId ?? null,
    now: new Date(options.at ?? Date.now()),
  })
}

beforeEach(async () => {
  await resetDatabase()
  await db.delete(comments)
  await db.delete(documents)
  await db.delete(user)

  const now = new Date()

  await db.insert(user).values(
    [author, guest].map((person) => ({
      id: person.id,
      name: person.email,
      email: person.email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    })),
  )

  await db.insert(documents).values([
    {
      id: 'doc-a',
      ownerId: author.id,
      title: 'Document A',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-b',
      ownerId: author.id,
      title: 'Document B',
      createdAt: now,
      updatedAt: now,
    },
  ])
})

describe('createComment', () => {
  it('creates a comment anchored to a block', async () => {
    const id = await seedComment('Review this paragraph', {
      blockId: 'block-1',
    })

    expect(id).not.toBeNull()

    const threads = await listDocumentComments('doc-a')

    expect(threads).toHaveLength(1)
    expect(threads[0]?.blockId).toBe('block-1')
    expect(threads[0]?.body).toBe('Review this paragraph')
    expect(threads[0]?.authorName).toBe(author.email)
    expect(threads[0]?.resolvedAt).toBeNull()
  })

  it('rejects an empty body or one with whitespace only', async () => {
    await expect(seedComment('   \n  ')).resolves.toBeNull()
    await expect(seedComment('')).resolves.toBeNull()
    await expect(countOpenComments('doc-a')).resolves.toBe(0)
  })

  it('trims the body and cuts it at the limit', async () => {
    await seedComment(`  ${'a'.repeat(MAX_COMMENT_LENGTH + 50)}  `)

    const threads = await listDocumentComments('doc-a')

    expect(threads[0]?.body).toHaveLength(MAX_COMMENT_LENGTH)
  })

  it('creates a one-level reply and ignores its own anchor', async () => {
    const root = await seedComment('Question', { blockId: 'block-1' })
    const reply = await seedComment('Reply', {
      blockId: 'block-9',
      parentId: root,
    })

    expect(reply).not.toBeNull()

    const threads = await listDocumentComments('doc-a')

    expect(threads).toHaveLength(1)
    expect(threads[0]?.replies).toHaveLength(1)
    expect(threads[0]?.replies[0]?.body).toBe('Reply')

    const stored = await getComment('doc-a', reply as string)

    expect(stored?.parentId).toBe(root)
  })

  it('rejects a reply to a reply', async () => {
    const root = await seedComment('Question')
    const reply = await seedComment('Reply', { parentId: root })

    await expect(
      seedComment('Reply to the reply', { parentId: reply }),
    ).resolves.toBeNull()
  })

  it('rejects a reply to a comment of another document', async () => {
    const root = await seedComment('Question', { documentId: 'doc-b' })

    await expect(
      seedComment('Reply', { documentId: 'doc-a', parentId: root }),
    ).resolves.toBeNull()
  })
})

describe('listDocumentComments', () => {
  it('lists the newest threads first and the replies in order', async () => {
    const first = await seedComment('First', { at: 1_000 })
    await seedComment('Second', { at: 2_000 })
    await seedComment('Old reply', { parentId: first, at: 3_000 })
    await seedComment('New reply', { parentId: first, at: 4_000 })

    const threads = await listDocumentComments('doc-a')

    expect(threads.map((thread) => thread.body)).toEqual(['Second', 'First'])
    expect(threads[1]?.replies.map((reply) => reply.body)).toEqual([
      'Old reply',
      'New reply',
    ])
  })

  it('does not mix comments of different documents', async () => {
    await seedComment('From A', { documentId: 'doc-a' })
    await seedComment('From B', { documentId: 'doc-b' })

    await expect(listDocumentComments('doc-a')).resolves.toHaveLength(1)
    await expect(listDocumentComments('doc-b')).resolves.toHaveLength(1)
  })
})

describe('countOpenComments', () => {
  it('counts only unresolved root threads', async () => {
    const first = await seedComment('First')
    await seedComment('Second')
    await seedComment('Reply', { parentId: first })

    await expect(countOpenComments('doc-a')).resolves.toBe(2)

    await setCommentResolved(first as string, true)

    await expect(countOpenComments('doc-a')).resolves.toBe(1)
  })
})

describe('resolve and reopen', () => {
  it('marks and unmarks without changing the updated_at of the body', async () => {
    const id = (await seedComment('Confusing passage', { at: 1_000 })) as string

    await setCommentResolved(id, true, new Date(5_000))

    const resolved = await getComment('doc-a', id)

    expect(resolved?.resolvedAt).toBe(5_000)

    const [threadResolved] = await listDocumentComments('doc-a')

    expect(threadResolved?.updatedAt).toBe(1_000)

    await setCommentResolved(id, false, new Date(9_000))

    await expect(getComment('doc-a', id)).resolves.toMatchObject({
      resolvedAt: null,
    })
  })

  it('does not resolve a reply', async () => {
    const root = await seedComment('Question')
    const reply = (await seedComment('Reply', {
      parentId: root,
    })) as string

    await expect(setCommentResolved(reply, true)).resolves.toBe(false)
  })
})

describe('edit and delete', () => {
  it('edits the body and moves the updated_at forward', async () => {
    const id = (await seedComment('Old text', { at: 1_000 })) as string

    await expect(
      updateCommentBody(id, 'New text', new Date(2_000)),
    ).resolves.toBe(true)

    const [thread] = await listDocumentComments('doc-a')

    expect(thread?.body).toBe('New text')
    expect(thread?.updatedAt).toBe(2_000)
    expect(thread?.createdAt).toBe(1_000)
  })

  it('rejects an edit to an empty body', async () => {
    const id = (await seedComment('Text')) as string

    await expect(updateCommentBody(id, '   ')).resolves.toBe(false)

    const [thread] = await listDocumentComments('doc-a')

    expect(thread?.body).toBe('Text')
  })

  it('deleting the root takes the replies with it', async () => {
    const root = (await seedComment('Question')) as string

    await seedComment('Reply', { parentId: root })

    await expect(deleteComment(root)).resolves.toBe(true)
    await expect(db.select().from(comments)).resolves.toHaveLength(0)
  })

  it('deleting a reply keeps the thread', async () => {
    const root = (await seedComment('Question')) as string
    const reply = (await seedComment('Reply', { parentId: root })) as string

    await deleteComment(reply)

    const threads = await listDocumentComments('doc-a')

    expect(threads).toHaveLength(1)
    expect(threads[0]?.replies).toHaveLength(0)
  })
})

describe('integrity', () => {
  it('deleting the document deletes the comments', async () => {
    await seedComment('Vanish with me')

    await db.delete(documents).where(eq(documents.id, 'doc-a'))

    await expect(db.select().from(comments)).resolves.toHaveLength(0)
  })

  it('deleting the author account keeps the comment without an author', async () => {
    await seedComment('Written by someone who left', { authorId: guest.id })

    await db.delete(user).where(eq(user.id, guest.id))

    const threads = await listDocumentComments('doc-a')

    expect(threads).toHaveLength(1)
    expect(threads[0]?.authorId).toBeNull()
    expect(threads[0]?.authorName).toBeNull()
  })

  it('getComment does not return a comment of another document', async () => {
    const id = (await seedComment('From B', { documentId: 'doc-b' })) as string

    await expect(getComment('doc-a', id)).resolves.toBeNull()
    await expect(getComment('doc-b', id)).resolves.not.toBeNull()
  })
})
