import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { readFileSync, readdirSync } = await import('node:fs')
  const { join } = await import('node:path')
  const Database = (await import('better-sqlite3')).default
  const { drizzle } = await import('drizzle-orm/better-sqlite3')
  const schema = await import('@/db/schema')

  const sqlite = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const folder = join(process.cwd(), 'drizzle')
  const files = readdirSync(folder)
    .filter((name) => name.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const contents = readFileSync(join(folder, file), 'utf8')

    for (const statement of contents.split('--> statement-breakpoint')) {
      const trimmed = statement.trim()

      if (trimmed.length > 0) {
        sqlite.exec(trimmed)
      }
    }
  }

  return { db: drizzle(sqlite, { schema }), schema }
})

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { documents, user } from '@/db/schema'
import {
  buildDocumentTree,
  listAncestors,
  listOwnedDocuments,
  listSubtreeIds,
} from '@/lib/documents'

const owner = { id: 'user-owner', email: 'dono@arvore.com.br' }

const tree = [
  { id: 'raiz', parentId: null, title: 'Raiz' },
  { id: 'filho', parentId: 'raiz', title: 'Filho' },
  { id: 'neto', parentId: 'filho', title: 'Neto' },
  { id: 'bisneto', parentId: 'neto', title: 'Bisneto' },
  { id: 'outra', parentId: null, title: 'Outra raiz' },
]

beforeEach(async () => {
  await db.delete(documents)
  await db.delete(user)

  const now = new Date()

  await db.insert(user).values({
    id: owner.id,
    name: 'Dono',
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

describe('hierarquia de documentos', () => {
  it('monta a árvore a partir do parent_id', async () => {
    const roots = buildDocumentTree(await listOwnedDocuments(owner.id))

    expect(roots.map((node) => node.id).sort()).toEqual(['outra', 'raiz'])

    const raiz = roots.find((node) => node.id === 'raiz')

    expect(raiz?.children.map((node) => node.id)).toEqual(['filho'])
    expect(raiz?.children[0].children[0].id).toBe('neto')
    expect(raiz?.children[0].children[0].depth).toBe(2)
  })

  it('devolve os ancestrais na ordem da raiz até o pai', async () => {
    const crumbs = await listAncestors('bisneto')

    expect(crumbs.map((crumb) => crumb.id)).toEqual(['raiz', 'filho', 'neto'])
  })

  it('não devolve ancestral que está na lixeira', async () => {
    await db
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(eq(documents.id, 'filho'))

    const crumbs = await listAncestors('neto')

    expect(crumbs).toEqual([])
  })

  it('lista a subárvore inteira a partir de um documento', async () => {
    const ids = await listSubtreeIds('filho', owner.id)

    expect(ids.sort()).toEqual(['bisneto', 'filho', 'neto'])
  })

  it('trata documento sem filhos como subárvore de um item', async () => {
    expect(await listSubtreeIds('outra', owner.id)).toEqual(['outra'])
  })
})
