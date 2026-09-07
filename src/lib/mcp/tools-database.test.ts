import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  databaseProperties,
  databaseViews,
  documentShares,
  documents,
  organizationMembers,
  organizations,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { colorForIndex, parseOptions, parseValues } from '@/lib/database/values'
import { parseViewConfig } from '@/lib/database/views'
import { type McpToolContext, McpToolError } from '@/lib/mcp/tools'
import {
  addDatabasePropertyTool,
  createDatabaseRowTool,
  createDatabaseTool,
  createDatabaseViewTool,
  deleteDatabasePropertyTool,
  deleteDatabaseRowTool,
  queryDatabaseTool,
  updateDatabasePropertyTool,
  updateDatabaseRowTool,
  updateDatabaseViewTool,
} from '@/lib/mcp/tools-database'

const owner = { id: 'dbt-owner', email: 'dono@example.com' }
const editor = { id: 'dbt-editor', email: 'editor@example.com' }
const reader = { id: 'dbt-reader', email: 'leitor@example.com' }
const stranger = { id: 'dbt-stranger', email: 'fora@example.com' }

const org = 'org-dbt'
const database = 'db-turmas'
const readScopes = ['leaf:read', 'offline_access']
const writeScopes = ['leaf:read', 'leaf:write', 'offline_access']
const longAgo = new Date(Date.now() - 60_000)

const turnoOptions = [
  { id: 'opt-manha', name: 'Manhã', color: colorForIndex(0) },
  { id: 'opt-tarde', name: 'Tarde', color: colorForIndex(1) },
]

function contextFor(
  person: { id: string; email: string },
  scopes: Array<string> = writeScopes,
): McpToolContext {
  return { session: { user: person }, scopes, clientId: 'client-test' }
}

async function failure(promise: Promise<unknown>) {
  try {
    await promise
  } catch (error) {
    return error instanceof McpToolError ? error.code : 'other'
  }

  return 'no-error'
}

beforeEach(async () => {
  await resetDatabase()

  await db.insert(user).values(
    [owner, editor, reader, stranger].map((person) => ({
      id: person.id,
      name: person.email.split('@')[0],
      email: person.email,
      emailVerified: true,
      createdAt: longAgo,
      updatedAt: longAgo,
    })),
  )

  await db.insert(organizations).values({ id: org, name: 'Escola', createdAt: longAgo })
  await db.insert(organizationMembers).values([
    { id: 'dm1', orgId: org, userId: owner.id, role: 'owner', createdAt: longAgo },
    { id: 'dm2', orgId: org, userId: editor.id, role: 'member', createdAt: longAgo },
    { id: 'dm3', orgId: org, userId: reader.id, role: 'member', createdAt: longAgo },
  ])

  await db.insert(documents).values([
    { id: 'page-home', ownerId: owner.id, orgId: org, title: 'Página', createdAt: longAgo, updatedAt: longAgo },
    { id: database, ownerId: owner.id, orgId: org, kind: 'database', title: 'Turmas', createdAt: longAgo, updatedAt: longAgo },
    { id: 'row-6a', ownerId: owner.id, parentId: database, orgId: org, kind: 'row', title: '6º A', properties: JSON.stringify({ 'prop-livros': 12, 'prop-turno': 'opt-manha', 'prop-ativa': true }), createdAt: longAgo, updatedAt: longAgo },
    { id: 'row-7b', ownerId: owner.id, parentId: database, orgId: org, kind: 'row', title: '7º B', properties: JSON.stringify({ 'prop-livros': 3, 'prop-turno': 'opt-tarde', 'prop-ativa': false }), createdAt: new Date(longAgo.getTime() + 1000), updatedAt: longAgo },
    { id: 'row-7b-notes', ownerId: owner.id, parentId: 'row-7b', orgId: org, title: 'Notas do 7º B', createdAt: longAgo, updatedAt: longAgo },
  ])

  await db.insert(databaseProperties).values([
    { id: 'prop-livros', databaseId: database, name: 'Livros', type: 'number', position: 0, createdAt: longAgo },
    { id: 'prop-turno', databaseId: database, name: 'Turno', type: 'select', options: JSON.stringify(turnoOptions), position: 1, createdAt: longAgo },
    { id: 'prop-ativa', databaseId: database, name: 'Ativa', type: 'checkbox', position: 2, createdAt: longAgo },
  ])

  await db.insert(databaseViews).values({ id: 'view-table', databaseId: database, name: 'Tabela', type: 'table', config: null, position: 0, createdAt: longAgo })

  await db.insert(documentShares).values([
    { id: 'ds1', documentId: database, granteeEmail: editor.email, role: 'editor', createdAt: longAgo },
    { id: 'ds2', documentId: database, granteeEmail: reader.email, role: 'viewer', createdAt: longAgo },
  ])
})

describe('query_database', () => {
  it('filters and sorts by property name and resolves option names', async () => {
    const result = await queryDatabaseTool(contextFor(reader, readScopes), {
      databaseId: database,
      filters: [{ property: 'Livros', operator: 'greaterThan', value: 5 }],
    })

    expect(result.total).toBe(1)
    expect(result.rows[0].title).toBe('6º A')
    expect(result.rows[0].values.Turno).toBe('Manhã')
    expect(result.rows[0].rawValues.Turno).toBe('opt-manha')

    const byOption = await queryDatabaseTool(contextFor(reader, readScopes), {
      databaseId: database,
      filters: [{ property: 'turno', operator: 'is', value: 'Tarde' }],
    })

    expect(byOption.rows.map((row) => row.title)).toEqual(['7º B'])

    const sorted = await queryDatabaseTool(contextFor(reader, readScopes), {
      databaseId: database,
      sorts: [{ property: 'Livros', direction: 'asc' }],
    })

    expect(sorted.rows.map((row) => row.title)).toEqual(['7º B', '6º A'])
  })

  it('refuses unknown properties, wrong operators and outsiders', async () => {
    expect(
      await failure(
        queryDatabaseTool(contextFor(reader, readScopes), {
          databaseId: database,
          filters: [{ property: 'Cor', operator: 'is', value: 'x' }],
        }),
      ),
    ).toBe('invalid_argument')

    expect(
      await failure(
        queryDatabaseTool(contextFor(reader, readScopes), {
          databaseId: database,
          filters: [{ property: 'Ativa', operator: 'greaterThan', value: 1 }],
        }),
      ),
    ).toBe('invalid_argument')

    expect(
      await failure(
        queryDatabaseTool(contextFor(stranger, readScopes), { databaseId: database }),
      ),
    ).toBe('not_found')
  })
})

describe('create_database_row', () => {
  it('creates a row with values by name for an editor', async () => {
    const result = await createDatabaseRowTool(contextFor(editor), {
      databaseId: database,
      title: '8º C',
      values: { Livros: '7', turno: 'Manhã', Ativa: true },
      markdown: 'Turma nova.',
    })

    expect(result.title).toBe('8º C')
    expect(result.values.Turno).toBe('Manhã')

    const stored = await db.query.documents.findFirst({
      where: eq(documents.id, result.id),
    })

    expect(stored?.kind).toBe('row')
    expect(stored?.parentId).toBe(database)
    expect(parseValues(stored?.properties ?? null)).toEqual({
      'prop-livros': 7,
      'prop-turno': 'opt-manha',
      'prop-ativa': true,
    })
    expect(stored?.content).toContain('Turma nova.')
  })

  it('refuses an unknown option, a reader, an outsider and a token without write', async () => {
    expect(
      await failure(
        createDatabaseRowTool(contextFor(editor), {
          databaseId: database,
          values: { Turno: 'Noite' },
        }),
      ),
    ).toBe('invalid_argument')

    expect(
      await failure(createDatabaseRowTool(contextFor(reader), { databaseId: database })),
    ).toBe('forbidden')

    expect(
      await failure(createDatabaseRowTool(contextFor(stranger), { databaseId: database })),
    ).toBe('not_found')

    expect(
      await failure(
        createDatabaseRowTool(contextFor(editor, readScopes), { databaseId: database }),
      ),
    ).toBe('write_disabled')
  })
})

describe('update_database_row and delete_database_row', () => {
  it('merges values, renames and keeps what was not sent', async () => {
    const result = await updateDatabaseRowTool(contextFor(editor), {
      rowId: 'row-6a',
      title: '6º A (manhã)',
      values: { Livros: 20 },
    })

    expect(result.title).toBe('6º A (manhã)')
    expect(result.rawValues.Livros).toBe(20)
    expect(result.rawValues.Turno).toBe('opt-manha')

    expect(
      await failure(updateDatabaseRowTool(contextFor(reader), { rowId: 'row-6a', title: 'x' })),
    ).toBe('forbidden')
  })

  it('moves the row and its subpages to the trash', async () => {
    const result = await deleteDatabaseRowTool(contextFor(editor), { rowId: 'row-7b' })

    expect(result.trashed).toBe(true)

    const trashed = await db
      .select({ id: documents.id, deletedAt: documents.deletedAt })
      .from(documents)
      .where(eq(documents.parentId, 'row-7b'))

    expect(trashed[0].deletedAt).not.toBeNull()

    const row = await db.query.documents.findFirst({ where: eq(documents.id, 'row-7b') })

    expect(row?.deletedAt).not.toBeNull()

    expect(
      await failure(deleteDatabaseRowTool(contextFor(editor), { rowId: 'row-7b' })),
    ).toBe('not_found')
  })
})

describe('create_database and properties', () => {
  it('creates a database inside a page with typed properties and a table view', async () => {
    const result = await createDatabaseTool(contextFor(owner), {
      title: 'Leituras',
      parentId: 'page-home',
      properties: [
        { name: 'Livro', type: 'text' },
        { name: 'Status', type: 'status', options: ['Lendo', 'Lido'] },
      ],
    })

    expect(result.parentId).toBe('page-home')
    expect(result.properties.map((property) => property.name)).toEqual(['Livro', 'Status'])
    expect(result.properties[1].options).toEqual(['Lendo', 'Lido'])
    expect(result.views[0].type).toBe('table')

    const stored = await db.query.documents.findFirst({ where: eq(documents.id, result.id) })

    expect(stored?.kind).toBe('database')
    expect(stored?.orgId).toBe(org)

    expect(
      await failure(createDatabaseTool(contextFor(stranger), { title: 'x', parentId: 'page-home' })),
    ).toBe('forbidden')
  })

  it('adds, updates and deletes properties for an editor only', async () => {
    const added = await addDatabasePropertyTool(contextFor(editor), {
      databaseId: database,
      name: 'Etiquetas',
      type: 'multiSelect',
      options: ['Leitura', 'Escrita'],
    })

    expect(added.property.options).toEqual(['Leitura', 'Escrita'])

    const renamed = await updateDatabasePropertyTool(contextFor(editor), {
      databaseId: database,
      property: 'Etiquetas',
      name: 'Tags',
      addOptions: ['Escrita', 'Oralidade'],
    })

    expect(renamed.property.name).toBe('Tags')
    expect(renamed.property.options).toEqual(['Leitura', 'Escrita', 'Oralidade'])

    const retyped = await updateDatabasePropertyTool(contextFor(editor), {
      databaseId: database,
      property: 'Ativa',
      type: 'text',
    })

    expect(retyped.property.type).toBe('text')

    expect(
      await failure(
        addDatabasePropertyTool(contextFor(editor), { databaseId: database, name: 'Livros', type: 'number' }),
      ),
    ).toBe('invalid_argument')

    expect(
      await failure(
        addDatabasePropertyTool(contextFor(reader), { databaseId: database, name: 'Nova', type: 'text' }),
      ),
    ).toBe('forbidden')

    const deleted = await deleteDatabasePropertyTool(contextFor(editor), {
      databaseId: database,
      property: 'prop-livros',
    })

    expect(deleted.deleted.name).toBe('Livros')

    const remaining = await db
      .select({ name: databaseProperties.name, position: databaseProperties.position })
      .from(databaseProperties)
      .where(eq(databaseProperties.databaseId, database))

    expect(remaining.map((property) => property.position).sort()).toEqual([0, 1, 2])
    expect(remaining.map((property) => property.name)).not.toContain('Livros')
  })
})

describe('views', () => {
  it('creates and updates a view with filters and sorts by property name', async () => {
    const created = await createDatabaseViewTool(contextFor(editor), {
      databaseId: database,
      type: 'board',
      name: 'Por turno',
      groupBy: 'Turno',
      filters: [{ property: 'Ativa', operator: 'is', value: true }],
      sorts: [{ property: 'Livros', direction: 'desc' }],
    })

    expect(created.view.type).toBe('board')
    expect(created.view.groupBy).toBe('Turno')
    expect(created.view.filters[0]).toEqual({ property: 'Ativa', operator: 'is', value: true })

    const stored = await db.query.databaseViews.findFirst({
      where: eq(databaseViews.id, created.view.id),
    })
    const config = parseViewConfig(stored?.config ?? null)

    expect(config.groupByPropertyId).toBe('prop-turno')
    expect(config.sorts).toEqual([{ propertyId: 'prop-livros', direction: 'desc' }])

    const updated = await updateDatabaseViewTool(contextFor(editor), {
      databaseId: database,
      viewId: created.view.id,
      name: 'Turno ativo',
      hiddenProperties: ['Livros'],
    })

    expect(updated.view.name).toBe('Turno ativo')
    expect(updated.view.hiddenProperties).toEqual(['Livros'])
    expect(updated.view.groupBy).toBe('Turno')

    expect(
      await failure(
        createDatabaseViewTool(contextFor(reader), { databaseId: database, type: 'table' }),
      ),
    ).toBe('forbidden')

    expect(
      await failure(
        createDatabaseViewTool(contextFor(editor), { databaseId: database, type: 'form' }),
      ),
    ).toBe('invalid_argument')
  })

  it('keeps the option ids of a select when retyping to status', async () => {
    const retyped = await updateDatabasePropertyTool(contextFor(editor), {
      databaseId: database,
      property: 'Turno',
      type: 'status',
    })

    expect(retyped.property.type).toBe('status')

    const stored = await db.query.databaseProperties.findFirst({
      where: eq(databaseProperties.id, 'prop-turno'),
    })

    expect(parseOptions(stored?.options ?? null).map((option) => option.id)).toEqual([
      'opt-manha',
      'opt-tarde',
    ])
  })
})
