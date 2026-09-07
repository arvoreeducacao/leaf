import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  databaseProperties,
  documentShares,
  documents,
  organizationMembers,
  organizations,
  teamspaceMembers,
  teamspaces,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { parseValues } from '@/lib/database/values'
import {
  type McpToolContext,
  McpToolError,
  createDocumentTool,
  updateDocumentTool,
} from '@/lib/mcp/tools'
import {
  duplicateDocumentTool,
  moveDocumentTool,
  restoreDocumentTool,
  trashDocumentTool,
} from '@/lib/mcp/tools-pages'

const owner = { id: 'pg-owner', email: 'dono@example.com' }
const editor = { id: 'pg-editor', email: 'editor@example.com' }
const stranger = { id: 'pg-stranger', email: 'fora@example.com' }

const org = 'org-pg'
const teamspace = 'ts-pg'
const writeScopes = ['leaf:read', 'leaf:write', 'offline_access']
const longAgo = new Date(Date.now() - 60_000)

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

function paragraph(text: string) {
  return JSON.stringify([
    { id: 'b1', type: 'paragraph', props: {}, content: [{ type: 'text', text, styles: {} }], children: [] },
  ])
}

beforeEach(async () => {
  await resetDatabase()

  await db.insert(user).values(
    [owner, editor, stranger].map((person) => ({
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
    { id: 'pm1', orgId: org, userId: owner.id, role: 'owner', createdAt: longAgo },
    { id: 'pm2', orgId: org, userId: editor.id, role: 'member', createdAt: longAgo },
  ])
  await db.insert(teamspaces).values({ id: teamspace, orgId: org, name: 'Pedagógico', access: 'open', createdAt: longAgo })
  await db.insert(teamspaceMembers).values({ id: 'ptm1', teamspaceId: teamspace, userId: owner.id, role: 'owner', createdAt: longAgo })

  await db.insert(documents).values([
    { id: 'pg-root', ownerId: owner.id, orgId: org, title: 'Raiz', content: paragraph('Raiz.'), createdAt: longAgo, updatedAt: longAgo },
    { id: 'pg-child', ownerId: owner.id, parentId: 'pg-root', orgId: org, title: 'Filha', content: paragraph('Filha.'), createdAt: longAgo, updatedAt: longAgo },
    { id: 'pg-grandchild', ownerId: owner.id, parentId: 'pg-child', orgId: org, title: 'Neta', createdAt: longAgo, updatedAt: longAgo },
    { id: 'pg-other', ownerId: owner.id, orgId: org, title: 'Outra', createdAt: longAgo, updatedAt: longAgo },
    { id: 'pg-db', ownerId: owner.id, orgId: org, kind: 'database', title: 'Leituras', createdAt: longAgo, updatedAt: longAgo },
    { id: 'pg-row', ownerId: owner.id, parentId: 'pg-db', orgId: org, kind: 'row', title: 'Dom Casmurro', properties: JSON.stringify({ 'pg-prop-paginas': 256 }), createdAt: longAgo, updatedAt: longAgo },
  ])

  await db.insert(databaseProperties).values({ id: 'pg-prop-paginas', databaseId: 'pg-db', name: 'Páginas', type: 'number', position: 0, createdAt: longAgo })

  await db.insert(documentShares).values({ id: 'pgs1', documentId: 'pg-child', granteeEmail: editor.email, role: 'editor', createdAt: longAgo })
})

describe('move_document', () => {
  it('moves a subtree under another page and inherits its placement', async () => {
    await db.update(documents).set({ teamspaceId: teamspace }).where(eq(documents.id, 'pg-other'))

    const result = await moveDocumentTool(contextFor(owner), {
      documentId: 'pg-child',
      parentId: 'pg-other',
    })

    expect(result.parentId).toBe('pg-other')
    expect(result.movedDocuments).toBe(2)

    const grandchild = await db.query.documents.findFirst({ where: eq(documents.id, 'pg-grandchild') })

    expect(grandchild?.teamspaceId).toBe(teamspace)
  })

  it('moves to a teamspace, to the organization and back to private', async () => {
    const toTeamspace = await moveDocumentTool(contextFor(owner), {
      documentId: 'pg-root',
      teamspaceId: teamspace,
    })

    expect(toTeamspace.teamspaceId).toBe(teamspace)
    expect(toTeamspace.parentId).toBeNull()

    const toOrganization = await moveDocumentTool(contextFor(owner), {
      documentId: 'pg-root',
      destination: 'organization',
    })

    expect(toOrganization.inOrganization).toBe(true)
    expect(toOrganization.teamspaceId).toBeNull()

    const toPrivate = await moveDocumentTool(contextFor(owner), {
      documentId: 'pg-root',
      destination: 'private',
    })

    expect(toPrivate.inOrganization).toBe(false)
    expect(toPrivate.teamspaceId).toBeNull()
  })

  it('refuses cycles, non-owners, two targets and moving into a database', async () => {
    expect(
      await failure(moveDocumentTool(contextFor(owner), { documentId: 'pg-root', parentId: 'pg-grandchild' })),
    ).toBe('invalid_argument')

    expect(
      await failure(moveDocumentTool(contextFor(editor), { documentId: 'pg-child', destination: 'private' })),
    ).toBe('forbidden')

    expect(
      await failure(moveDocumentTool(contextFor(stranger), { documentId: 'pg-child', destination: 'private' })),
    ).toBe('not_found')

    expect(
      await failure(
        moveDocumentTool(contextFor(owner), { documentId: 'pg-child', parentId: 'pg-other', destination: 'private' }),
      ),
    ).toBe('invalid_argument')

    expect(
      await failure(moveDocumentTool(contextFor(owner), { documentId: 'pg-other', parentId: 'pg-db' })),
    ).toBe('invalid_argument')
  })
})

describe('duplicate_document', () => {
  it('copies a page and a database with its rows', async () => {
    const page = await duplicateDocumentTool(contextFor(owner), { documentId: 'pg-child' })

    expect(page.title).toBe('Cópia de Filha')
    expect(page.parentId).toBe('pg-root')

    const database = await duplicateDocumentTool(
      { ...contextFor(owner), locale: 'en-US' },
      { documentId: 'pg-db' },
    )

    expect(database.title).toBe('Copy of Leituras')
    expect(database.rows).toBe(1)

    const rows = await db.select().from(documents).where(eq(documents.parentId, database.id))

    expect(rows).toHaveLength(1)
    expect(rows[0].kind).toBe('row')

    expect(
      await failure(duplicateDocumentTool(contextFor(editor), { documentId: 'pg-child' })),
    ).toBe('forbidden')
  })
})

describe('trash_document and restore_document', () => {
  it('trashes the subtree and restores it, dropping to the root when the parent is gone', async () => {
    const trashed = await trashDocumentTool(contextFor(owner), { documentId: 'pg-child' })

    expect(trashed.trashedDocuments).toBe(2)

    const grandchild = await db.query.documents.findFirst({ where: eq(documents.id, 'pg-grandchild') })

    expect(grandchild?.deletedAt).not.toBeNull()

    expect(
      await failure(trashDocumentTool(contextFor(editor), { documentId: 'pg-root' })),
    ).toBe('not_found')

    await trashDocumentTool(contextFor(owner), { documentId: 'pg-root' })

    const restored = await restoreDocumentTool(contextFor(owner), { documentId: 'pg-child' })

    expect(restored.restoredDocuments).toBe(2)
    expect(restored.parentId).toBeNull()

    const child = await db.query.documents.findFirst({ where: eq(documents.id, 'pg-child') })

    expect(child?.deletedAt).toBeNull()
    expect(child?.parentId).toBeNull()

    expect(
      await failure(restoreDocumentTool(contextFor(editor), { documentId: 'pg-root' })),
    ).toBe('not_found')
  })
})

describe('update_document metadata', () => {
  it('renames, sets icon and cover, and writes row values without touching the body', async () => {
    const result = await updateDocumentTool(contextFor(editor), {
      documentId: 'pg-child',
      title: 'Filha renomeada',
      icon: '🌿',
      cover: 'https://images.example.com/capa.jpg',
    })

    expect(result.written).toBe(true)
    expect(result.updated.sort()).toEqual(['cover', 'icon', 'title'])

    const stored = await db.query.documents.findFirst({ where: eq(documents.id, 'pg-child') })

    expect(stored?.title).toBe('Filha renomeada')
    expect(stored?.icon).toBe('🌿')
    expect(stored?.cover).toBe('https://images.example.com/capa.jpg')
    expect(stored?.content).toContain('Filha.')

    const row = await updateDocumentTool(contextFor(owner), {
      documentId: 'pg-row',
      values: { Páginas: 300 },
    })

    expect(row.updated).toEqual(['properties'])

    const storedRow = await db.query.documents.findFirst({ where: eq(documents.id, 'pg-row') })

    expect(parseValues(storedRow?.properties ?? null)).toEqual({ 'pg-prop-paginas': 300 })

    const removed = await updateDocumentTool(contextFor(owner), {
      documentId: 'pg-child',
      icon: null,
    })

    expect(removed.updated).toEqual(['icon'])

    expect(
      await failure(updateDocumentTool(contextFor(owner), { documentId: 'pg-child' })),
    ).toBe('invalid_argument')

    expect(
      await failure(updateDocumentTool(contextFor(owner), { documentId: 'pg-child', values: { x: 1 } })),
    ).toBe('invalid_argument')
  })

  it('creates a page with icon and cover', async () => {
    const created = await createDocumentTool(contextFor(owner), {
      title: 'Com ícone',
      icon: '📚',
      cover: 'https://images.example.com/capa.jpg',
    })

    expect(created.icon).toBe('📚')

    const stored = await db.query.documents.findFirst({ where: eq(documents.id, created.id) })

    expect(stored?.cover).toBe('https://images.example.com/capa.jpg')

    expect(
      await failure(createDocumentTool(contextFor(owner), { title: 'x', cover: 'ftp://nope' })),
    ).toBe('invalid_argument')
  })
})
