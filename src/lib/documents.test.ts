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
  capDocumentTree,
  listAncestors,
  listOwnedDocuments,
  listSubtreeIds,
} from '@/lib/documents'

const owner = { id: 'user-owner', email: 'owner@example.com' }

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

describe('sidebar tree cap', () => {
  function roots(count: number) {
    return buildDocumentTree(
      Array.from({ length: count }, (_, index) => ({
        id: `doc-${index}`,
        title: `Document ${index}`,
        updatedAt: new Date(),
        deletedAt: null,
        parentId: null,
        kind: 'page' as const,
        icon: null,
        shared: false,
        owned: true,
      })),
    )
  }

  it('keeps every root when the list is within the limit', () => {
    const capped = capDocumentTree(roots(5), 20)

    expect(capped.nodes).toHaveLength(5)
    expect(capped.hidden).toBe(0)
  })

  it('keeps the limit and reports how many stayed out', () => {
    const capped = capDocumentTree(roots(3216), 20)

    expect(capped.nodes).toHaveLength(20)
    expect(capped.hidden).toBe(3196)
  })

  it('hides a document whose parent is not in the listing instead of promoting it', () => {
    const nodes = buildDocumentTree([
      {
        id: 'orphan',
        title: 'Subpage of a database row',
        updatedAt: new Date(),
        deletedAt: null,
        parentId: 'row-outside-the-listing',
        kind: 'page' as const,
        icon: null,
        shared: false,
        owned: true,
      },
      {
        id: 'root',
        title: 'Root',
        updatedAt: new Date(),
        deletedAt: null,
        parentId: null,
        kind: 'page' as const,
        icon: null,
        shared: false,
        owned: true,
      },
    ])

    expect(nodes.map((node) => node.id)).toEqual(['root'])
  })

  it('keeps the children of the roots it does keep', () => {
    const nodes = buildDocumentTree([
      {
        id: 'root',
        title: 'Root',
        updatedAt: new Date(),
        deletedAt: null,
        parentId: null,
        kind: 'page' as const,
        icon: null,
        shared: false,
        owned: true,
      },
      {
        id: 'child',
        title: 'Child',
        updatedAt: new Date(),
        deletedAt: null,
        parentId: 'root',
        kind: 'page' as const,
        icon: null,
        shared: false,
        owned: true,
      },
    ])

    const capped = capDocumentTree(nodes, 1)

    expect(capped.nodes[0]?.children.map((node) => node.id)).toEqual(['child'])
  })
})
