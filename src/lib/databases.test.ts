import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { db } from '@/db'
import {
  databaseProperties,
  databaseViews,
  documentShares,
  documents,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { getDocumentAccess } from '@/lib/authz'
import { serializeOptions, serializeValues } from '@/lib/database/values'
import { parseViewConfig, serializeViewConfig } from '@/lib/database/views'
import {
  copyDatabaseInto,
  listDatabaseRows,
  loadDatabase,
  loadRowContext,
} from '@/lib/databases'

const owner = { id: 'user-owner', email: 'owner@arvore.com.br' }
const guest = { id: 'user-guest', email: 'guest@arvore.com.br' }

const statusOptions = [
  { id: 'todo', name: 'To do', color: 'gray' as const },
  { id: 'done', name: 'Done', color: 'success' as const },
]

const now = new Date('2026-03-01T12:00:00.000Z')

function at(minutes: number) {
  return new Date(now.getTime() + minutes * 60_000)
}

const viewConfig = serializeViewConfig({
  groupByPropertyId: 'prop-status',
  filters: [{ propertyId: 'prop-points', operator: 'greaterThan', value: 1 }],
  sorts: [{ propertyId: 'title', direction: 'asc' }],
  hiddenPropertyIds: ['prop-points'],
})

beforeEach(async () => {
  await resetDatabase()

  await db.insert(user).values([
    {
      id: owner.id,
      name: 'Owner',
      email: owner.email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: guest.id,
      name: 'Guest',
      email: guest.email,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    },
  ])

  await db.insert(documents).values([
    {
      id: 'base',
      ownerId: owner.id,
      kind: 'database',
      title: 'Orders',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'linha-1',
      ownerId: owner.id,
      parentId: 'base',
      kind: 'row',
      title: 'Alfa',
      properties: serializeValues({
        'prop-status': 'todo',
        'prop-points': 3,
      }),
      createdAt: at(1),
      updatedAt: at(1),
    },
    {
      id: 'linha-2',
      ownerId: owner.id,
      parentId: 'base',
      kind: 'row',
      title: 'Beta',
      properties: serializeValues({ 'prop-status': 'done' }),
      createdAt: at(2),
      updatedAt: at(2),
    },
    {
      id: 'linha-morta',
      ownerId: owner.id,
      parentId: 'base',
      kind: 'row',
      title: 'Deleted',
      createdAt: at(3),
      updatedAt: at(3),
      deletedAt: at(4),
    },
    {
      id: 'subpagina',
      ownerId: owner.id,
      parentId: 'base',
      kind: 'page',
      title: 'An ordinary page',
      createdAt: at(5),
      updatedAt: at(5),
    },
  ])

  await db.insert(databaseProperties).values([
    {
      id: 'prop-points',
      databaseId: 'base',
      name: 'Points',
      type: 'number',
      position: 1,
      createdAt: now,
    },
    {
      id: 'prop-status',
      databaseId: 'base',
      name: 'Status',
      type: 'select',
      options: serializeOptions(statusOptions),
      position: 0,
      createdAt: now,
    },
  ])

  await db.insert(databaseViews).values({
    id: 'view-1',
    databaseId: 'base',
    name: 'Table',
    type: 'table',
    config: viewConfig,
    position: 0,
    createdAt: now,
  })
})

describe('reading a database', () => {
  it('returns the properties in position order', async () => {
    const snapshot = await loadDatabase('base')

    expect(snapshot?.properties.map((item) => item.id)).toEqual([
      'prop-status',
      'prop-points',
    ])
  })

  it('lists only the live rows, in creation order', async () => {
    const rows = await listDatabaseRows('base')

    expect(rows.map((row) => row.id)).toEqual(['linha-1', 'linha-2'])
  })

  it('does not mistake an ordinary subpage for a row', async () => {
    const rows = await listDatabaseRows('base')

    expect(rows.map((row) => row.id)).not.toContain('subpagina')
  })

  it('reads the row values already converted', async () => {
    const rows = await listDatabaseRows('base')

    expect(rows[0].values).toEqual({ 'prop-status': 'todo', 'prop-points': 3 })
    expect(typeof rows[0].createdAt).toBe('string')
  })

  it('does not open a document that is not a database', async () => {
    await expect(loadDatabase('linha-1')).resolves.toBeNull()
    await expect(loadDatabase('subpagina')).resolves.toBeNull()
  })

  it('returns the row context with the database and the properties', async () => {
    const context = await loadRowContext('linha-1')

    expect(context?.databaseId).toBe('base')
    expect(context?.databaseTitle).toBe('Orders')
    expect(context?.properties).toHaveLength(2)
    expect(context?.row.title).toBe('Alfa')
  })

  it('returns no context for a document that is not a row', async () => {
    await expect(loadRowContext('subpagina')).resolves.toBeNull()
  })
})

describe('row access', () => {
  it('inherits the sharing of the database', async () => {
    await db.insert(documentShares).values({
      id: 'share-1',
      documentId: 'base',
      granteeEmail: guest.email,
      role: 'editor',
      createdAt: now,
    })

    await expect(
      getDocumentAccess('linha-1', { user: guest }),
    ).resolves.toBe('editor')
  })

  it('denies the row when the database was not shared', async () => {
    await expect(
      getDocumentAccess('linha-1', { user: guest }),
    ).resolves.toBeNull()
  })

  it('downgrades along when the database is read-only', async () => {
    await db.insert(documentShares).values({
      id: 'share-2',
      documentId: 'base',
      granteeEmail: guest.email,
      role: 'viewer',
      createdAt: now,
    })

    await expect(
      getDocumentAccess('linha-1', { user: guest }),
    ).resolves.toBe('viewer')
  })

  it('keeps the row owner with owner access', async () => {
    await expect(
      getDocumentAccess('linha-1', { user: owner }),
    ).resolves.toBe('owner')
  })
})

describe('duplicating a database', () => {
  beforeEach(async () => {
    await db.insert(documents).values({
      id: 'copia',
      ownerId: owner.id,
      kind: 'database',
      title: 'Orders (cópia)',
      createdAt: at(10),
      updatedAt: at(10),
    })
  })

  it('copies properties, views and rows', async () => {
    const created = await copyDatabaseInto('base', 'copia', owner.id, at(10))
    const snapshot = await loadDatabase('copia')

    expect(created).toHaveLength(2)
    expect(snapshot?.properties).toHaveLength(2)
    expect(snapshot?.views).toHaveLength(1)
    expect(snapshot?.rows.map((row) => row.title)).toEqual(['Alfa', 'Beta'])
  })

  it('repoints the row values at the new properties', async () => {
    await copyDatabaseInto('base', 'copia', owner.id, at(10))
    const snapshot = await loadDatabase('copia')
    const status = snapshot?.properties.find((item) => item.name === 'Status')
    const alfa = snapshot?.rows.find((row) => row.title === 'Alfa')

    expect(status).toBeDefined()
    expect(status?.id).not.toBe('prop-status')
    expect(alfa?.values[status?.id ?? '']).toBe('todo')
    expect(alfa?.values['prop-status']).toBeUndefined()
  })

  it('repoints the configuration of the copied view', async () => {
    await copyDatabaseInto('base', 'copia', owner.id, at(10))
    const snapshot = await loadDatabase('copia')
    const config = parseViewConfig(snapshot?.views[0]?.config ?? null)
    const ids = new Set(snapshot?.properties.map((item) => item.id))

    expect(config.groupByPropertyId).not.toBe('prop-status')
    expect(ids.has(config.groupByPropertyId ?? '')).toBe(true)
    expect(ids.has(config.filters[0]?.propertyId ?? '')).toBe(true)
    expect(ids.has(config.hiddenPropertyIds[0] ?? '')).toBe(true)
    expect(config.sorts[0]?.propertyId).toBe('title')
  })

  it('does not carry the deleted row into the copy', async () => {
    await copyDatabaseInto('base', 'copia', owner.id, at(10))
    const rows = await listDatabaseRows('copia')

    expect(rows.map((row) => row.title)).not.toContain('Deleted')
  })
})
