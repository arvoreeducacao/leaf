import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { db } from '@/db'
import { documents, user } from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import {
  isRealtimeStateStale,
  newRealtimeIdentity,
  readRealtimeIdentity,
  readRealtimeState,
  writeRealtimeState,
} from '@/lib/realtime-state'

const owner = { id: 'user-owner', email: 'owner@example.com', name: 'Owner' }
const docId = 'doc-with-state'

beforeEach(async () => {
  await resetDatabase()

  const now = new Date('2026-09-01T12:00:00.000Z')

  await db.insert(user).values({
    id: owner.id,
    name: owner.name,
    email: owner.email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(documents).values({
    id: docId,
    ownerId: owner.id,
    title: 'Document',
    createdAt: now,
    updatedAt: now,
  })
})

describe('server-side Yjs state', () => {
  it('returns the binary and the identity that were written', async () => {
    const state = new Uint8Array([1, 2, 3, 250])
    const identity = newRealtimeIdentity()

    await writeRealtimeState(docId, state, identity)

    const stored = await readRealtimeState(docId)

    expect(stored?.identity).toBe(identity)
    expect(stored ? Array.from(stored.state) : null).toEqual([1, 2, 3, 250])
  })

  it('does not exist before the first write', async () => {
    expect(await readRealtimeState(docId)).toBeNull()
    expect(await readRealtimeIdentity(docId)).toBeNull()
  })

  it('keeps the identity when the state is written again', async () => {
    const identity = newRealtimeIdentity()

    await writeRealtimeState(docId, new Uint8Array([1]), identity)
    await writeRealtimeState(docId, new Uint8Array([1, 2]), newRealtimeIdentity())

    const stored = await readRealtimeState(docId)

    expect(stored?.identity).toBe(identity)
    expect(stored ? Array.from(stored.state) : null).toEqual([1, 2])
  })

  it('goes away with the document', async () => {
    await writeRealtimeState(docId, new Uint8Array([1]), newRealtimeIdentity())
    await db.delete(documents).where(eq(documents.id, docId))

    expect(await readRealtimeState(docId)).toBeNull()
  })
})

describe('isRealtimeStateStale', () => {
  const state = new Date('2026-09-01T12:00:00.000Z')

  it('treats state written alongside the document as fresh', () => {
    expect(isRealtimeStateStale(state, state)).toBe(false)
  })

  it('treats state written after the document as fresh', () => {
    expect(
      isRealtimeStateStale(state, new Date('2026-09-01T11:59:59.000Z')),
    ).toBe(false)
  })

  it('treats state from before a solo write as stale', () => {
    expect(
      isRealtimeStateStale(state, new Date('2026-09-01T12:00:01.000Z')),
    ).toBe(true)
  })
})
