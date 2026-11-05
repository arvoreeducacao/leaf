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
  readRealtimeIdentity,
  readRealtimeState,
  reseedRealtimeState,
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
    const identity = await reseedRealtimeState(
      docId,
      new Uint8Array([1, 2, 3, 250]),
    )

    const stored = await readRealtimeState(docId)

    expect(stored?.identity).toBe(identity)
    expect(stored ? Array.from(stored.state) : null).toEqual([1, 2, 3, 250])
  })

  it('creates an identity on the first save', async () => {
    await writeRealtimeState(docId, new Uint8Array([1]))

    expect(await readRealtimeIdentity(docId)).toMatch(/^[A-Za-z0-9_-]{16}$/)
  })

  it('does not exist before the first write', async () => {
    expect(await readRealtimeState(docId)).toBeNull()
    expect(await readRealtimeIdentity(docId)).toBeNull()
  })

  it('keeps the identity when the room saves again', async () => {
    const identity = await reseedRealtimeState(docId, new Uint8Array([1]))

    await writeRealtimeState(docId, new Uint8Array([1, 2]))

    const stored = await readRealtimeState(docId)

    expect(stored?.identity).toBe(identity)
    expect(stored ? Array.from(stored.state) : null).toEqual([1, 2])
  })

  it('changes the identity when the room is seeded again', async () => {
    const first = await reseedRealtimeState(docId, new Uint8Array([1]))
    const second = await reseedRealtimeState(docId, new Uint8Array([3]))

    const stored = await readRealtimeState(docId)

    expect(second).not.toBe(first)
    expect(stored?.identity).toBe(second)
    expect(stored ? Array.from(stored.state) : null).toEqual([3])
  })

  it('goes away with the document', async () => {
    await writeRealtimeState(docId, new Uint8Array([1]))
    await db.delete(documents).where(eq(documents.id, docId))

    expect(await readRealtimeState(docId)).toBeNull()
  })
})
