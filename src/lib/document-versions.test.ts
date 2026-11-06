import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

vi.mock('@/lib/realtime-room', () => ({
  rewriteLiveRoomBlocks: vi.fn(async () => 'no-room'),
  writeBlocksToLiveRoom: vi.fn(async () => 'no-room'),
}))

import { db } from '@/db'
import { documentVersions, documents, user } from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import {
  MAX_VERSIONS_PER_DOCUMENT,
  VERSION_THROTTLE_MS,
  applyDocumentVersion,
  getDocumentVersion,
  listDocumentVersions,
  pruneDocumentVersions,
  recordDocumentVersion,
} from '@/lib/document-versions'
import {
  rewriteLiveRoomBlocks,
  writeBlocksToLiveRoom,
} from '@/lib/realtime-room'

const author = { id: 'user-author', email: 'author@example.com', name: 'Ana' }
const mate = { id: 'user-mate', email: 'mate@example.com', name: '' }

const docId = 'doc-versioned'
const start = new Date('2026-08-30T12:00:00.000Z')

function at(offsetMs: number) {
  return new Date(start.getTime() + offsetMs)
}

async function setContent(content: string | null, title = 'Document') {
  await db
    .update(documents)
    .set({ content, title })
    .where(eq(documents.id, docId))
}

beforeEach(async () => {
  await resetDatabase()
  await db.delete(documentVersions)
  await db.delete(documents)
  await db.delete(user)

  for (const person of [author, mate]) {
    await db.insert(user).values({
      id: person.id,
      name: person.name,
      email: person.email,
      emailVerified: true,
      createdAt: start,
      updatedAt: start,
    })
  }

  await db.insert(documents).values({
    id: docId,
    ownerId: author.id,
    title: 'Document',
    content: '[{"id":"a"}]',
    createdAt: start,
    updatedAt: start,
  })
})

describe('throttle', () => {
  it('records the first version and holds the second by the same author within 5 min', async () => {
    expect(await recordDocumentVersion(docId, author.id, { now: at(0) })).toBe(
      true,
    )

    await setContent('[{"id":"b"}]')

    expect(
      await recordDocumentVersion(docId, author.id, {
        now: at(VERSION_THROTTLE_MS - 1),
      }),
    ).toBe(false)

    expect(await listDocumentVersions(docId)).toHaveLength(1)
  })

  it('records again after the 5 min window', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    await setContent('[{"id":"b"}]')

    expect(
      await recordDocumentVersion(docId, author.id, {
        now: at(VERSION_THROTTLE_MS),
      }),
    ).toBe(true)

    const versions = await listDocumentVersions(docId)

    expect(versions).toHaveLength(2)
    expect(versions[0]?.createdAt).toBe(at(VERSION_THROTTLE_MS).getTime())
  })

  it('the window is per author', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    await setContent('[{"id":"b"}]')

    expect(
      await recordDocumentVersion(docId, mate.id, { now: at(1_000) }),
    ).toBe(true)
    expect(await listDocumentVersions(docId)).toHaveLength(2)
  })

  it('force ignores the window', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    await setContent('[{"id":"b"}]')

    expect(
      await recordDocumentVersion(docId, author.id, {
        force: true,
        now: at(1_000),
      }),
    ).toBe(true)
  })

  it('does not record a version when the state is identical to the last one', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })

    expect(
      await recordDocumentVersion(docId, mate.id, {
        force: true,
        now: at(1_000),
      }),
    ).toBe(false)
    expect(await listDocumentVersions(docId)).toHaveLength(1)
  })

  it('does not record a version of a document that does not exist', async () => {
    expect(await recordDocumentVersion('doc-ghost', author.id)).toBe(false)
  })
})

describe('pruning', () => {
  it('keeps only the 50 most recent versions', async () => {
    const total = MAX_VERSIONS_PER_DOCUMENT + 5

    for (let index = 0; index < total; index += 1) {
      await db.insert(documentVersions).values({
        id: `v-${String(index).padStart(3, '0')}`,
        documentId: docId,
        title: 'Document',
        content: `[{"id":"${index}"}]`,
        authorId: author.id,
        createdAt: at(index * 1_000),
      })
    }

    expect(await pruneDocumentVersions(docId)).toBe(5)

    const versions = await listDocumentVersions(docId)

    expect(versions).toHaveLength(MAX_VERSIONS_PER_DOCUMENT)
    expect(versions[0]?.id).toBe(`v-${String(total - 1).padStart(3, '0')}`)
    expect(versions.at(-1)?.id).toBe('v-005')
  })

  it('the pruning happens on insert', async () => {
    for (let index = 0; index < MAX_VERSIONS_PER_DOCUMENT; index += 1) {
      await db.insert(documentVersions).values({
        id: `v-${String(index).padStart(3, '0')}`,
        documentId: docId,
        title: 'Document',
        content: `[{"id":"${index}"}]`,
        authorId: author.id,
        createdAt: at(index * 1_000),
      })
    }

    await setContent('[{"id":"new"}]')
    await recordDocumentVersion(docId, mate.id, {
      now: at(MAX_VERSIONS_PER_DOCUMENT * 1_000),
    })

    const versions = await listDocumentVersions(docId)

    expect(versions).toHaveLength(MAX_VERSIONS_PER_DOCUMENT)
    expect(await getDocumentVersion(docId, versions[0]!.id)).toMatchObject({
      content: '[{"id":"new"}]',
    })
    expect(versions.some((version) => version.id === 'v-000')).toBe(false)
  })

  it('the pruning does not touch versions of another document', async () => {
    await db.insert(documents).values({
      id: 'doc-neighbor',
      ownerId: author.id,
      title: 'Neighbor',
      content: null,
      createdAt: start,
      updatedAt: start,
    })

    await db.insert(documentVersions).values({
      id: 'v-neighbor',
      documentId: 'doc-neighbor',
      title: 'Neighbor',
      content: null,
      authorId: author.id,
      createdAt: at(0),
    })

    for (let index = 0; index < MAX_VERSIONS_PER_DOCUMENT + 3; index += 1) {
      await db.insert(documentVersions).values({
        id: `v-${String(index).padStart(3, '0')}`,
        documentId: docId,
        title: 'Document',
        content: `[{"id":"${index}"}]`,
        authorId: author.id,
        createdAt: at(index * 1_000),
      })
    }

    await pruneDocumentVersions(docId)

    expect(await listDocumentVersions('doc-neighbor')).toHaveLength(1)
  })
})

describe('restore', () => {
  it('does the round-trip keeping the current state before applying', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    const [first] = await listDocumentVersions(docId)

    await setContent('[{"id":"after"}]', 'New title')

    const restored = await applyDocumentVersion(
      docId,
      first!.id,
      mate.id,
      at(60_000),
    )

    expect(restored).toMatchObject({
      status: 'applied',
      version: { content: '[{"id":"a"}]' },
    })

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, docId),
    })

    expect(document?.content).toBe('[{"id":"a"}]')
    expect(document?.title).toBe('Document')

    const versions = await listDocumentVersions(docId)

    expect(versions).toHaveLength(2)
    expect(await getDocumentVersion(docId, versions[0]!.id)).toMatchObject({
      content: '[{"id":"after"}]',
      title: 'New title',
    })
  })

  it('returns null for a version of another document', async () => {
    await db.insert(documents).values({
      id: 'doc-neighbor',
      ownerId: author.id,
      title: 'Neighbor',
      content: '[{"id":"neighbor"}]',
      createdAt: start,
      updatedAt: start,
    })

    await db.insert(documentVersions).values({
      id: 'v-neighbor',
      documentId: 'doc-neighbor',
      title: 'Neighbor',
      content: '[{"id":"neighbor"}]',
      authorId: author.id,
      createdAt: at(0),
    })

    expect(
      await applyDocumentVersion(docId, 'v-neighbor', author.id, at(1_000)),
    ).toEqual({ status: 'not-found' })

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, docId),
    })

    expect(document?.content).toBe('[{"id":"a"}]')
  })

  it('writes the restored text through the live room when one is open', async () => {
    const written: Array<unknown> = []

    vi.mocked(rewriteLiveRoomBlocks).mockImplementationOnce(
      async (_id, rewrite) => {
        written.push(rewrite([{ id: 'live' }]).blocks)

        return 'applied'
      },
    )
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    const [first] = await listDocumentVersions(docId)

    await setContent('[{"id":"after"}]', 'New title')

    const restored = await applyDocumentVersion(
      docId,
      first!.id,
      mate.id,
      at(60_000),
    )

    expect(restored).toMatchObject({ status: 'applied' })
    expect(written).toEqual([[{ id: 'a' }]])

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, docId),
    })

    expect(document?.content).toBe('[{"id":"after"}]')
    expect(document?.title).toBe('Document')
  })

  it('keeps what the room held before the restore, even text not saved yet', async () => {
    vi.mocked(rewriteLiveRoomBlocks).mockImplementationOnce(
      async (_id, rewrite) => {
        rewrite([{ id: 'live' }])
        await setContent('[{"id":"a"}]', 'New title')

        return 'applied'
      },
    )
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    const [first] = await listDocumentVersions(docId)

    await setContent('[{"id":"after"}]', 'New title')
    await applyDocumentVersion(docId, first!.id, mate.id, at(60_000))

    const [beforeRestore] = await listDocumentVersions(docId)
    const saved = await getDocumentVersion(docId, beforeRestore!.id)

    expect(saved?.content).toBe('[{"id":"live"}]')
    expect(saved?.title).toBe('New title')
  })

  it('sends the restored text to a room that opened while it was being saved', async () => {
    vi.mocked(writeBlocksToLiveRoom).mockResolvedValueOnce('applied')
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    const [first] = await listDocumentVersions(docId)

    await setContent('[{"id":"after"}]')
    await applyDocumentVersion(docId, first!.id, mate.id, at(60_000))

    expect(writeBlocksToLiveRoom).toHaveBeenLastCalledWith(
      docId,
      [{ id: 'a' }],
      'replace',
      mate.id,
    )

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, docId),
    })

    expect(document?.content).toBe('[{"id":"a"}]')
  })

  it('refuses to restore when the live room does not answer, and keeps the text', async () => {
    vi.mocked(rewriteLiveRoomBlocks).mockResolvedValueOnce('unreachable')
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    const [first] = await listDocumentVersions(docId)

    await setContent('[{"id":"after"}]', 'New title')

    expect(
      await applyDocumentVersion(docId, first!.id, mate.id, at(60_000)),
    ).toEqual({ status: 'room-unreachable' })

    const document = await db.query.documents.findFirst({
      where: eq(documents.id, docId),
    })

    expect(document?.content).toBe('[{"id":"after"}]')
    expect(document?.title).toBe('New title')
    expect(await listDocumentVersions(docId)).toHaveLength(1)
  })

  it('restoring twice in a row does not duplicate the identical snapshot', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    const [first] = await listDocumentVersions(docId)

    await setContent('[{"id":"after"}]')
    await applyDocumentVersion(docId, first!.id, author.id, at(60_000))
    await applyDocumentVersion(docId, first!.id, author.id, at(120_000))

    expect(await listDocumentVersions(docId)).toHaveLength(2)
  })
})

describe('listing', () => {
  it('brings the author and falls back to the email when there is no name', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    await setContent('[{"id":"b"}]')
    await recordDocumentVersion(docId, mate.id, { now: at(1_000) })

    const versions = await listDocumentVersions(docId)

    expect(versions[0]?.authorName).toBe(mate.email)
    expect(versions[1]?.authorName).toBe('Ana')
  })

  it('survives the removed author', async () => {
    await recordDocumentVersion(docId, mate.id, { now: at(0) })
    await db.delete(user).where(eq(user.id, mate.id))

    const versions = await listDocumentVersions(docId)

    expect(versions).toHaveLength(1)
    expect(versions[0]?.authorId).toBeNull()
    expect(versions[0]?.authorName).toBeNull()
  })

  it('the versions vanish along with the document', async () => {
    await recordDocumentVersion(docId, author.id, { now: at(0) })
    await db.delete(documents).where(eq(documents.id, docId))

    expect(await listDocumentVersions(docId)).toHaveLength(0)
  })
})
