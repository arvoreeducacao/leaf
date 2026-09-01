import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { documents, user } from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import {
  buildDocumentTree,
  listAncestors,
  listOwnedDocuments,
  listSubtreeIds,
} from '@/lib/documents'

const owner = { id: 'user-owner', email: 'owner@arvore.com.br' }

const tree = [
  { id: 'root', parentId: null, title: 'Root' },
  { id: 'child', parentId: 'root', title: 'Child' },
  { id: 'grandchild', parentId: 'child', title: 'Grandchild' },
  { id: 'great-grandchild', parentId: 'grandchild', title: 'Great-grandchild' },
  { id: 'other', parentId: null, title: 'Other root' },
]

beforeEach(async () => {
  await resetDatabase()
  await db.delete(documents)
  await db.delete(user)

  const now = new Date()

  await db.insert(user).values({
    id: owner.id,
    name: 'Owner',
    email: owner.email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  })

  for (const item of tree) {
    await db.insert(documents).values({
      id: item.id,
      ownerId: owner.id,
      parentId: item.parentId,
      title: item.title,
      createdAt: now,
      updatedAt: now,
    })
  }
})

describe('document hierarchy', () => {
  it('builds the tree from the parent_id', async () => {
    const roots = buildDocumentTree(await listOwnedDocuments(owner.id))

    expect(roots.map((node) => node.id).sort()).toEqual(['other', 'root'])

    const root = roots.find((node) => node.id === 'root')

    expect(root?.children.map((node) => node.id)).toEqual(['child'])
    expect(root?.children[0].children[0].id).toBe('grandchild')
    expect(root?.children[0].children[0].depth).toBe(2)
  })

  it('returns the ancestors in order from the root down to the parent', async () => {
    const crumbs = await listAncestors('great-grandchild')

    expect(crumbs.map((crumb) => crumb.id)).toEqual([
      'root',
      'child',
      'grandchild',
    ])
  })

  it('does not return an ancestor that is in the trash', async () => {
    await db
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(eq(documents.id, 'child'))

    const crumbs = await listAncestors('grandchild')

    expect(crumbs).toEqual([])
  })

  it('lists the whole subtree from a document', async () => {
    const ids = await listSubtreeIds('child', owner.id)

    expect(ids.sort()).toEqual(['child', 'grandchild', 'great-grandchild'])
  })

  it('treats a document without children as a one-item subtree', async () => {
    expect(await listSubtreeIds('other', owner.id)).toEqual(['other'])
  })
})
