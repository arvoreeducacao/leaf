import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

const liveRoom = vi.hoisted(() => ({
  openFor: null as string | null,
  blocks: [] as Array<unknown>,
  calls: [] as Array<{ documentId: string; rewritten: unknown }>,
  meanwhile: null as null | (() => Promise<void>),
}))

vi.mock('@/lib/realtime-room', () => ({
  rewriteLiveRoomBlocks: vi.fn(
    async (
      documentId: string,
      rewrite: (blocks: Array<unknown>) => {
        blocks: Array<unknown>
        changed: boolean
      },
    ) => {
      await liveRoom.meanwhile?.()

      if (liveRoom.openFor !== documentId) {
        return 'no-room'
      }

      const rewritten = rewrite(liveRoom.blocks as Array<unknown>)

      liveRoom.calls.push({ documentId, rewritten })

      return rewritten.changed ? 'applied' : 'untouched'
    },
  ),
}))

import { db } from '@/db'
import { documents, user } from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { retitleLinksToDocument } from '@/lib/document-link-propagation'

const author = { id: 'user-author', email: 'author@example.com' }
const now = new Date('2026-01-10T12:00:00.000Z')

function paragraphWithLink(href: string, text: string) {
  return JSON.stringify([
    {
      id: 'block-1',
      type: 'paragraph',
      content: [
        { type: 'link', href, content: [{ type: 'text', text, styles: {} }] },
      ],
    },
  ])
}

async function contentOf(id: string) {
  const row = await db.query.documents.findFirst({
    where: eq(documents.id, id),
  })

  return row?.content ?? ''
}

beforeEach(async () => {
  await resetDatabase()
  liveRoom.openFor = null
  liveRoom.blocks = []
  liveRoom.calls.length = 0
  liveRoom.meanwhile = null

  await db.insert(user).values({
    id: author.id,
    name: 'Author',
    email: author.email,
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(documents).values([
    {
      id: 'doc-target',
      ownerId: author.id,
      title: 'Cronograma de envios',
      content: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-parent',
      ownerId: author.id,
      title: 'Plano de comunicação',
      content: paragraphWithLink('/doc/doc-target', 'Sem título'),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-handwritten',
      ownerId: author.id,
      title: 'Outro plano',
      content: paragraphWithLink('/doc/doc-target', 'veja o cronograma'),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'doc-trashed',
      ownerId: author.id,
      title: 'Plano na lixeira',
      content: paragraphWithLink('/doc/doc-target', 'Sem título'),
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    },
  ])
})

describe('retitleLinksToDocument', () => {
  it('writes the new title into the documents that link to it', async () => {
    const retitled = await retitleLinksToDocument(
      'doc-target',
      'Sem título',
      'Cronograma de envios',
      author.id,
    )

    expect(retitled).toBe(1)
    expect(await contentOf('doc-parent')).toContain('Cronograma de envios')
  })

  it('does not touch the link whose text someone wrote by hand', async () => {
    await retitleLinksToDocument(
      'doc-target',
      'Sem título',
      'Cronograma de envios',
      author.id,
    )

    expect(await contentOf('doc-handwritten')).toContain('veja o cronograma')
  })

  it('leaves the trashed document alone', async () => {
    await retitleLinksToDocument(
      'doc-target',
      'Sem título',
      'Cronograma de envios',
      author.id,
    )

    expect(await contentOf('doc-trashed')).toContain('Sem título')
  })

  it('does nothing when the title did not really change', async () => {
    const retitled = await retitleLinksToDocument(
      'doc-target',
      'Sem título',
      ' Sem título ',
      author.id,
    )

    expect(retitled).toBe(0)
    expect(liveRoom.calls).toEqual([])
  })

  it('writes through the live session and leaves the database alone', async () => {
    liveRoom.openFor = 'doc-parent'
    liveRoom.blocks = [
      {
        id: 'block-1',
        type: 'paragraph',
        content: [
          {
            type: 'link',
            href: '/doc/doc-target',
            content: [{ type: 'text', text: 'Sem título', styles: {} }],
          },
        ],
      },
    ]

    const retitled = await retitleLinksToDocument(
      'doc-target',
      'Sem título',
      'Cronograma de envios',
      author.id,
    )

    expect(retitled).toBe(1)
    expect(liveRoom.calls.map((call) => call.documentId)).toContain('doc-parent')
    expect(await contentOf('doc-parent')).toContain('Sem título')
  })

  it('rewrites what the live session holds, not what the database saved', async () => {
    liveRoom.openFor = 'doc-parent'
    liveRoom.blocks = [
      {
        id: 'block-1',
        type: 'paragraph',
        content: [
          {
            type: 'link',
            href: '/doc/doc-target',
            content: [{ type: 'text', text: 'Sem título', styles: {} }],
          },
        ],
      },
      {
        id: 'block-2',
        type: 'paragraph',
        content: [
          { type: 'text', text: 'linha digitada agora', styles: {} },
        ],
      },
    ]

    await retitleLinksToDocument(
      'doc-target',
      'Sem título',
      'Cronograma de envios',
      author.id,
    )

    const call = liveRoom.calls.find((entry) => entry.documentId === 'doc-parent')
    const rewritten = JSON.stringify(
      (call?.rewritten as { blocks: unknown }).blocks,
    )

    expect(rewritten).toContain('linha digitada agora')
    expect(rewritten).toContain('Cronograma de envios')
  })

  it('does not write an empty title over the link', async () => {
    const retitled = await retitleLinksToDocument(
      'doc-target',
      'Sem título',
      '   ',
      author.id,
    )

    expect(retitled).toBe(0)
    expect(await contentOf('doc-parent')).toContain('Sem título')
  })

  it('gives up on the document that changed while it worked', async () => {
    liveRoom.meanwhile = async () => {
      await db
        .update(documents)
        .set({ updatedAt: new Date('2026-02-02T10:00:00.000Z') })
        .where(eq(documents.id, 'doc-parent'))
    }

    const retitled = await retitleLinksToDocument(
      'doc-target',
      'Sem título',
      'Cronograma de envios',
      author.id,
    )

    expect(retitled).toBe(0)
    expect(await contentOf('doc-parent')).toContain('Sem título')
  })
})
