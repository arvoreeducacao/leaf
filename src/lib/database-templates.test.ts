import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }))

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) => (key: string) =>
    `${namespace}.${key}`,
}))

vi.mock('@/lib/auth', () => ({
  getSession: async () => ({ user: { id: 'user-owner', email: 'owner@arvore.com.br' } }),
}))

vi.mock('@/lib/search-index', () => ({
  indexDocument: async () => undefined,
  removeDocumentFromIndex: async () => undefined,
}))

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { databaseProperties, documents, user } from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import {
  createDatabaseRow,
  createDatabaseTemplate,
  deleteDatabaseTemplate,
  duplicateDatabaseTemplate,
  setDefaultDatabaseTemplate,
} from '@/lib/database-actions'
import { serializeValues } from '@/lib/database/values'
import {
  copyDatabaseInto,
  listDatabaseRows,
  listDatabaseTemplates,
  loadDatabase,
  loadRowContext,
} from '@/lib/databases'
import { listOwnedDocuments, listTrashedDocuments } from '@/lib/documents'

const owner = { id: 'user-owner', email: 'owner@arvore.com.br' }
const now = new Date('2026-03-01T12:00:00.000Z')

function at(minutes: number) {
  return new Date(now.getTime() + minutes * 60_000)
}

beforeEach(async () => {
  await resetDatabase()

  await db.insert(user).values({
    id: owner.id,
    name: 'Owner',
    email: owner.email,
    emailVerified: false,
    createdAt: now,
    updatedAt: now,
  })

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
      id: 'row-alfa',
      ownerId: owner.id,
      parentId: 'base',
      kind: 'row',
      title: 'Alfa',
      createdAt: at(1),
      updatedAt: at(1),
    },
    {
      id: 'template-bug',
      ownerId: owner.id,
      parentId: 'base',
      kind: 'template',
      title: 'Bug report',
      icon: '🐛',
      content: '{"blocks":["steps to reproduce"]}',
      properties: serializeValues({ 'prop-status': 'todo' }),
      createdAt: at(2),
      updatedAt: at(2),
    },
    {
      id: 'template-morto',
      ownerId: owner.id,
      parentId: 'base',
      kind: 'template',
      title: 'Deleted template',
      createdAt: at(3),
      updatedAt: at(3),
      deletedAt: at(4),
    },
  ])

  await db.insert(databaseProperties).values({
    id: 'prop-status',
    databaseId: 'base',
    name: 'Status',
    type: 'text',
    position: 0,
    createdAt: now,
  })
})

describe('database templates', () => {
  it('lists live templates without mixing them into the rows', async () => {
    const templates = await listDatabaseTemplates('base')
    const rows = await listDatabaseRows('base')

    expect(templates.map((template) => template.id)).toEqual(['template-bug'])
    expect(rows.map((row) => row.id)).toEqual(['row-alfa'])
  })

  it('keeps templates out of the sidebar', async () => {
    const owned = await listOwnedDocuments(owner.id)

    expect(owned.map((item) => item.id)).not.toContain('template-bug')
    expect(owned.map((item) => item.id)).toContain('base')
  })

  it('sends a trashed template to the trash so it can be restored', async () => {
    const trashed = await listTrashedDocuments(owner.id)

    expect(trashed.map((item) => item.id)).toContain('template-morto')
  })

  it('hides templates of a trashed database from the trash', async () => {
    await db
      .update(documents)
      .set({ deletedAt: at(5) })
      .where(eq(documents.id, 'base'))

    const trashed = await listTrashedDocuments(owner.id)

    expect(trashed.map((item) => item.id)).toContain('base')
    expect(trashed.map((item) => item.id)).not.toContain('template-morto')
  })

  it('exposes templates and the default on the snapshot', async () => {
    await setDefaultDatabaseTemplate('base', 'template-bug')

    const snapshot = await loadDatabase('base', owner.id)

    expect(snapshot?.templates.map((template) => template.id)).toEqual([
      'template-bug',
    ])
    expect(snapshot?.defaultTemplateId).toBe('template-bug')
  })

  it('marks a template when it is opened as a page', async () => {
    await setDefaultDatabaseTemplate('base', 'template-bug')

    const template = await loadRowContext('template-bug', owner.id)
    const row = await loadRowContext('row-alfa', owner.id)

    expect(template?.isTemplate).toBe(true)
    expect(template?.isDefaultTemplate).toBe(true)
    expect(row?.isTemplate).toBe(false)
  })

  it('copies title, icon, body and values into a row made from a template', async () => {
    const result = await createDatabaseRow('base', {}, '', 'template-bug')

    expect(result.ok).toBe(true)

    const created = await db.query.documents.findFirst({
      where: (fields, { eq }) =>
        eq(fields.id, result.ok ? result.row.id : 'missing'),
    })

    expect(created?.kind).toBe('row')
    expect(created?.title).toBe('Bug report')
    expect(created?.icon).toBe('🐛')
    expect(created?.content).toBe('{"blocks":["steps to reproduce"]}')
    expect(created?.properties).toBe(
      serializeValues({ 'prop-status': 'todo' }),
    )
  })

  it('lets an explicit seed win over the template value', async () => {
    const result = await createDatabaseRow(
      'base',
      { 'prop-status': 'done' },
      'Crash on save',
      'template-bug',
    )

    expect(result.ok).toBe(true)
    expect(result.ok && result.row.title).toBe('Crash on save')
    expect(result.ok && result.row.values['prop-status']).toBe('done')
  })

  it('refuses a template that belongs to another database', async () => {
    await db.insert(documents).values({
      id: 'other-base',
      ownerId: owner.id,
      kind: 'database',
      title: 'Other',
      createdAt: now,
      updatedAt: now,
    })

    const result = await createDatabaseRow('other-base', {}, '', 'template-bug')

    expect(result.ok).toBe(true)
    expect(result.ok && result.row.title).toBe('')
    expect(result.ok && result.row.icon).toBeNull()
  })

  it('creates, duplicates and trashes a template', async () => {
    const created = await createDatabaseTemplate('base')

    expect(created.ok).toBe(true)

    const copy = await duplicateDatabaseTemplate('template-bug')

    expect(copy.ok).toBe(true)

    const afterCopy = await listDatabaseTemplates('base')

    expect(afterCopy).toHaveLength(3)

    await deleteDatabaseTemplate('template-bug')

    const afterDelete = await listDatabaseTemplates('base')

    expect(afterDelete.map((template) => template.id)).not.toContain(
      'template-bug',
    )
  })

  it('carries templates and the default into a duplicated database', async () => {
    await setDefaultDatabaseTemplate('base', 'template-bug')

    await db.insert(documents).values({
      id: 'copy',
      ownerId: owner.id,
      kind: 'database',
      title: 'Orders copy',
      createdAt: at(6),
      updatedAt: at(6),
    })

    const rowIds = await copyDatabaseInto('base', 'copy', owner.id, at(6))

    expect(rowIds).toHaveLength(1)

    const snapshot = await loadDatabase('copy', owner.id)

    expect(snapshot?.templates.map((template) => template.title)).toEqual([
      'Bug report',
    ])
    expect(snapshot?.defaultTemplateId).toBe(snapshot?.templates[0]?.id)
    expect(snapshot?.rows.map((row) => row.title)).toEqual(['Alfa'])
  })

  it('clears the default when the default template is trashed', async () => {
    await setDefaultDatabaseTemplate('base', 'template-bug')
    await deleteDatabaseTemplate('template-bug')

    const snapshot = await loadDatabase('base', owner.id)

    expect(snapshot?.defaultTemplateId).toBeNull()
  })
})
