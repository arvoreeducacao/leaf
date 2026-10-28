import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { db } from '@/db'
import {
  documentLinks,
  documents,
  organizationMembers,
  organizations,
  teamspaces,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import {
  listDocumentLinks,
  organizationGraph,
  relationOf,
} from '@/lib/document-link-graph'

const owner = { id: 'user-owner', email: 'owner@example.com' }
const reader = { id: 'user-reader', email: 'reader@example.com' }

const org = 'org-acme'
const now = new Date('2026-10-01T12:00:00.000Z')

function sessionOf(person: { id: string; email: string }) {
  return { user: person }
}

function viewerOf(person: { id: string; email: string }) {
  return { userId: person.id, email: person.email }
}

function shared(id: string, extra: Partial<typeof documents.$inferInsert> = {}) {
  return {
    id,
    ownerId: owner.id,
    orgId: org,
    orgAccess: 'viewer' as const,
    title: id,
    createdAt: now,
    updatedAt: now,
    ...extra,
  }
}

beforeEach(async () => {
  await resetDatabase()

  await db.insert(user).values(
    [owner, reader].map((person) => ({
      id: person.id,
      name: person.email,
      email: person.email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    })),
  )

  await db.insert(organizations).values({ id: org, name: 'Acme', createdAt: now })

  await db.insert(organizationMembers).values([
    { id: 'm-owner', orgId: org, userId: owner.id, role: 'owner', createdAt: now },
    { id: 'm-reader', orgId: org, userId: reader.id, role: 'member', createdAt: now },
  ])

  await db.insert(teamspaces).values({ id: 'ts-eng', orgId: org, name: 'Engenharia', createdAt: now })

  await db.insert(documents).values([
    shared('guia', { title: 'Guia de deploy', teamspaceId: 'ts-eng' }),
    shared('onboarding', { title: 'Onboarding' }),
    shared('passo', { title: 'Passo a passo', parentId: 'guia' }),
    shared('ata', { title: 'Ata', deletedAt: now }),
    { id: 'privada', ownerId: owner.id, title: 'Notas privadas', createdAt: now, updatedAt: now },
    shared('base', { kind: 'database', title: 'Tarefas' }),
    shared('linha-ligada', { kind: 'row', parentId: 'base', title: 'Tarefa ligada' }),
    shared('linha-solta', { kind: 'row', parentId: 'base', title: 'Tarefa solta' }),
  ])

  await db.insert(documentLinks).values([
    { sourceId: 'onboarding', targetId: 'guia', context: 'Siga o Guia de deploy.' },
    { sourceId: 'guia', targetId: 'passo', context: 'Passo a passo' },
    { sourceId: 'privada', targetId: 'guia', context: 'segredo' },
    { sourceId: 'ata', targetId: 'guia', context: 'apagada' },
    { sourceId: 'linha-ligada', targetId: 'guia', context: 'Tarefa ligada ao guia' },
  ])
})

describe('relationOf', () => {
  it('tells a link to a subpage and to the parent apart from a citation', () => {
    expect(relationOf({ id: 'a', parentId: null }, { id: 'b', parentId: 'a' })).toBe('subpage')
    expect(relationOf({ id: 'b', parentId: 'a' }, { id: 'a', parentId: null })).toBe('parent')
    expect(relationOf({ id: 'a', parentId: null }, { id: 'c', parentId: null })).toBe('citation')
  })
})

describe('listDocumentLinks', () => {
  it('lists who cites the page and what it cites, with the sentence around the link', async () => {
    const links = await listDocumentLinks('guia', sessionOf(owner))

    expect(links.incoming.map((link) => [link.id, link.relation, link.context])).toEqual([
      ['privada', 'citation', 'segredo'],
      ['onboarding', 'citation', 'Siga o Guia de deploy.'],
      ['linha-ligada', 'citation', 'Tarefa ligada ao guia'],
    ])
    expect(links.outgoing.map((link) => [link.id, link.relation])).toEqual([['passo', 'subpage']])
  })

  it('hides documents the viewer cannot open and deleted ones', async () => {
    const links = await listDocumentLinks('guia', sessionOf(reader))
    const ids = links.incoming.map((link) => link.id)

    expect(ids).not.toContain('privada')
    expect(ids).not.toContain('ata')
    expect(ids).toEqual(['onboarding', 'linha-ligada'])
  })

  it('is empty for a page without links', async () => {
    expect(await listDocumentLinks('base', sessionOf(owner))).toEqual({ incoming: [], outgoing: [] })
  })
})

describe('organizationGraph', () => {
  it('keeps pages and databases, and rows only when they have a link', async () => {
    const graph = await organizationGraph(viewerOf(reader))
    const ids = graph.nodes.map((node) => node.id).sort()

    expect(ids).toEqual(['base', 'guia', 'linha-ligada', 'onboarding', 'passo'])
  })

  it('draws only edges whose two ends the viewer can open', async () => {
    const graph = await organizationGraph(viewerOf(reader))
    const edges = graph.edges.map((edge) => `${edge.source}>${edge.target}:${edge.relation}`).sort()

    expect(edges).toEqual([
      'guia>passo:subpage',
      'linha-ligada>guia:citation',
      'onboarding>guia:citation',
    ])
  })

  it('names the teamspaces present in the graph', async () => {
    const graph = await organizationGraph(viewerOf(reader))

    expect(graph.teamspaces).toEqual([{ id: 'ts-eng', name: 'Engenharia' }])
  })

  it('shows the owner their private pages', async () => {
    const graph = await organizationGraph(viewerOf(owner))

    expect(graph.nodes.map((node) => node.id)).toContain('privada')
    expect(graph.edges.map((edge) => edge.source)).toContain('privada')
  })
})
