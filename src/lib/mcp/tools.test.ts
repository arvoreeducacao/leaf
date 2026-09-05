import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

const stored: Array<{ key: string; bytes: number; contentType: string }> = []

vi.mock('@/lib/storage', () => ({
  storage: {
    async put(key: string, body: Buffer, contentType: string) {
      stored.push({ key, bytes: body.length, contentType })
    },
    async get() {
      return null
    },
  },
}))

import { eq } from 'drizzle-orm'

import { db } from '@/db'
import {
  comments,
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
import { reconcileSearchIndex } from '@/lib/search-index'
import { createLeafMcpServer } from '@/lib/mcp/server'
import {
  type McpToolContext,
  McpToolError,
  createDocumentTool,
  getDatabaseTool,
  getDocumentTool,
  listCommentsTool,
  listDocumentsTool,
  listOrganizationsTool,
  searchDocuments,
  updateDocumentTool,
  uploadImageTool,
} from '@/lib/mcp/tools'

const owner = { id: 'mcp-owner', email: 'dono@example.com' }
const editor = { id: 'mcp-editor', email: 'editor@example.com' }
const member = { id: 'mcp-member', email: 'membro@example.com' }
const stranger = { id: 'mcp-stranger', email: 'fora@example.com' }

const org = 'org-mcp'
const teamspace = 'ts-mcp'

const readScopes = ['leaf:read', 'offline_access']
const writeScopes = ['leaf:read', 'leaf:write', 'offline_access']

function contextFor(
  person: { id: string; email: string },
  scopes: Array<string> = writeScopes,
): McpToolContext {
  return { session: { user: person }, scopes, clientId: 'client-test' }
}

function paragraph(text: string) {
  return JSON.stringify([
    { id: 'b1', type: 'paragraph', props: {}, content: [{ type: 'text', text, styles: {} }], children: [] },
  ])
}

const longAgo = new Date(Date.now() - 60_000)

beforeEach(async () => {
  await resetDatabase()

  await db.insert(user).values(
    [owner, editor, member, stranger].map((person) => ({
      id: person.id,
      name: person.email.split('@')[0],
      email: person.email,
      emailVerified: true,
      createdAt: longAgo,
      updatedAt: longAgo,
    })),
  )

  await db.insert(organizations).values({ id: org, name: 'Escola MCP', createdAt: longAgo })
  await db.insert(organizationMembers).values([
    { id: 'm1', orgId: org, userId: owner.id, role: 'owner', createdAt: longAgo },
    { id: 'm2', orgId: org, userId: member.id, role: 'member', createdAt: longAgo },
    { id: 'm3', orgId: org, userId: editor.id, role: 'member', createdAt: longAgo },
  ])
  await db.insert(teamspaces).values({ id: teamspace, orgId: org, name: 'Pedagógico', access: 'closed', createdAt: longAgo })
  await db.insert(teamspaceMembers).values({ id: 'tm1', teamspaceId: teamspace, userId: member.id, role: 'member', createdAt: longAgo })

  await db.insert(documents).values([
    { id: 'doc-private', ownerId: owner.id, orgId: org, title: 'Plano secreto', content: paragraph('Segredo da direção sobre leitura.'), createdAt: longAgo, updatedAt: longAgo },
    { id: 'doc-shared', ownerId: owner.id, orgId: org, title: 'Ata compartilhada', content: paragraph('Cronograma de leitura do trimestre.'), createdAt: longAgo, updatedAt: longAgo },
    { id: 'doc-child', ownerId: owner.id, parentId: 'doc-shared', orgId: org, title: 'Anexo da ata', content: paragraph('Anexo.'), createdAt: longAgo, updatedAt: longAgo },
    { id: 'doc-org', ownerId: owner.id, orgId: org, orgAccess: 'viewer', title: 'Aviso da organização', content: paragraph('Leitura obrigatória para todos.'), createdAt: longAgo, updatedAt: longAgo },
    { id: 'doc-team', ownerId: owner.id, orgId: org, teamspaceId: teamspace, title: 'Plano do teamspace', content: paragraph('Plano do time de leitura.'), createdAt: longAgo, updatedAt: longAgo },
    { id: 'db-turmas', ownerId: owner.id, orgId: org, kind: 'database', title: 'Turmas', createdAt: longAgo, updatedAt: longAgo },
    { id: 'row-6a', ownerId: owner.id, parentId: 'db-turmas', orgId: org, kind: 'row', title: '6º A', properties: JSON.stringify({ 'prop-livros': 12 }), createdAt: longAgo, updatedAt: longAgo },
  ])

  await db.insert(databaseProperties).values({ id: 'prop-livros', databaseId: 'db-turmas', name: 'Livros', type: 'number', position: 0, createdAt: longAgo })

  await db.insert(documentShares).values([
    { id: 's1', documentId: 'doc-shared', granteeEmail: editor.email, role: 'editor', createdAt: longAgo },
    { id: 's2', documentId: 'doc-shared', granteeEmail: member.email, role: 'viewer', createdAt: longAgo },
  ])

  await db.insert(comments).values({
    id: 'c1',
    documentId: 'doc-shared',
    blockId: 'b1',
    authorId: owner.id,
    body: 'Revisar o cronograma',
    createdAt: longAgo,
    updatedAt: longAgo,
  })

  await reconcileSearchIndex()
})

async function expectToolError(promise: Promise<unknown>, code: McpToolError['code']) {
  await expect(promise).rejects.toMatchObject({ name: 'McpToolError', code })
}

describe('search_documents', () => {
  it('returns only documents the person can reach', async () => {
    const asMember = await searchDocuments(contextFor(member), { query: 'leitura' })
    const ids = asMember.results.map((hit) => hit.id).sort()

    expect(ids).toEqual(['doc-org', 'doc-shared', 'doc-team'])

    const asStranger = await searchDocuments(contextFor(stranger), { query: 'leitura' })

    expect(asStranger.results).toEqual([])
  })
})

describe('get_document', () => {
  it('renders markdown and filters children by the reader access', async () => {
    const result = await getDocumentTool(contextFor(member), { documentId: 'doc-shared' })

    expect(result.access).toBe('viewer')
    expect(result.markdown).toContain('Cronograma de leitura')
    expect(result.children).toEqual([])

    const asOwner = await getDocumentTool(contextFor(owner), { documentId: 'doc-shared' })

    expect(asOwner.children.map((child) => child.id)).toEqual(['doc-child'])
  })

  it('returns not_found for whoever has no access and for a malformed id', async () => {
    await expectToolError(getDocumentTool(contextFor(stranger), { documentId: 'doc-private' }), 'not_found')
    await expectToolError(getDocumentTool(contextFor(owner), { documentId: 'doc private' }), 'invalid_argument')
  })

  it('brings the resolved properties of a database row', async () => {
    const result = await getDocumentTool(contextFor(owner), { documentId: 'row-6a' })

    expect(result.properties).toEqual({ Livros: '12' })
    expect(result.database).toEqual({ id: 'db-turmas', title: 'Turmas' })
  })
})

describe('list_documents', () => {
  it('lists own, shared, organization and teamspace documents where the person is a member', async () => {
    const result = await listDocumentsTool(contextFor(member), {})
    const bySource = Object.fromEntries(result.documents.map((doc) => [doc.id, doc.source]))

    expect(bySource).toEqual({ 'doc-shared': 'shared', 'doc-org': 'organization', 'doc-team': 'teamspace' })
  })

  it('leaks nothing to an outsider', async () => {
    const result = await listDocumentsTool(contextFor(stranger), {})

    expect(result.documents).toEqual([])
  })
})

describe('list_organizations', () => {
  it('shows emails only to whoever administers the organization', async () => {
    const asOwner = await listOrganizationsTool(contextFor(owner))
    const asMember = await listOrganizationsTool(contextFor(member))

    expect(asOwner.organizations[0].members.every((person) => 'email' in person)).toBe(true)
    expect(asMember.organizations[0].members.every((person) => !('email' in person))).toBe(true)
    expect(asMember.organizations[0].teamspaces).toEqual([
      { id: teamspace, name: 'Pedagógico', access: 'closed', member: true },
    ])

    expect((await listOrganizationsTool(contextFor(stranger))).organizations).toEqual([])
  })
})

describe('get_database', () => {
  it('resolves values by property name and respects access', async () => {
    const result = await getDatabaseTool(contextFor(owner), { databaseId: 'db-turmas' })

    expect(result.properties.map((property) => property.name)).toEqual(['Livros'])
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].values).toEqual({ Livros: '12' })

    await expectToolError(getDatabaseTool(contextFor(stranger), { databaseId: 'db-turmas' }), 'not_found')
    await expectToolError(getDatabaseTool(contextFor(owner), { databaseId: 'doc-shared' }), 'not_found')
  })
})

describe('list_comments', () => {
  it('lists threads for a reader and refuses whoever cannot read', async () => {
    const result = await listCommentsTool(contextFor(member), { documentId: 'doc-shared' })

    expect(result.threads.map((thread) => thread.body)).toEqual(['Revisar o cronograma'])

    await expectToolError(listCommentsTool(contextFor(stranger), { documentId: 'doc-shared' }), 'not_found')
  })
})

describe('upload_image', () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01])

  it('stores the image and returns the address that goes into the page', async () => {
    const before = stored.length
    const result = await uploadImageTool(contextFor(member), {
      data: png.toString('base64'),
      contentType: 'image/png',
    })

    expect(result.url).toMatch(/^\/api\/uploads\/u\/[\w-]{16}\.png$/)
    expect(result.absoluteUrl.endsWith(result.url)).toBe(true)
    expect(result.bytes).toBe(png.length)
    expect(stored.length).toBe(before + 1)
    expect(stored.at(-1)?.contentType).toBe('image/png')
  })

  it('accepts SVG and stores it without the script and without the onload', async () => {
    const before = stored.length
    const result = await uploadImageTool(contextFor(member), {
      data: Buffer.from(
        '<svg viewBox="0 0 10 10" onload="x()"><script>roubar()</script><text>o desenho</text></svg>',
      ).toString('base64'),
      contentType: 'image/svg+xml',
    })

    expect(result.url).toMatch(/\.svg$/)
    expect(stored.length).toBe(before + 1)
    expect(result.bytes).toBeLessThan(
      Buffer.from('<svg viewBox="0 0 10 10" onload="x()"><script>roubar()</script><text>o desenho</text></svg>').length,
    )
  })

  it('refuses what claims to be SVG and is not', async () => {
    await expectToolError(
      uploadImageTool(contextFor(member), {
        data: Buffer.from('só um texto qualquer').toString('base64'),
        contentType: 'image/svg+xml',
      }),
      'invalid_argument',
    )
  })

  it('refuses bytes that are not the type they claim to be', async () => {
    await expectToolError(
      uploadImageTool(contextFor(member), {
        data: Buffer.from('MZ ainda não é imagem').toString('base64'),
        contentType: 'image/png',
      }),
      'invalid_argument',
    )
  })

  it('refuses what is not base64 and what goes over 500 kB', async () => {
    await expectToolError(
      uploadImageTool(contextFor(member), { data: 'não é base64!', contentType: 'image/png' }),
      'invalid_argument',
    )

    const big = Buffer.concat([png, Buffer.alloc(500_001)])

    await expectToolError(
      uploadImageTool(contextFor(member), {
        data: big.toString('base64'),
        contentType: 'image/png',
      }),
      'invalid_argument',
    )
  })

  it('stores nothing without the leaf:write scope', async () => {
    await expectToolError(
      uploadImageTool(contextFor(owner, readScopes), {
        data: png.toString('base64'),
        contentType: 'image/png',
      }),
      'write_disabled',
    )
  })
})

describe('create_document', () => {
  it('creates a page private to the user behind the token', async () => {
    const result = await createDocumentTool(contextFor(member), {
      title: 'Nova página',
      markdown: '# Título\n\nParágrafo.',
    })

    const created = await db.query.documents.findFirst({ where: eq(documents.id, result.id) })

    expect(created?.ownerId).toBe(member.id)
    expect(created?.orgId).toBe(org)
    expect(created?.orgAccess).toBeNull()
    expect(created?.content).toContain('Parágrafo.')
  })

  it('requires canEdit on the parent and inherits its organization and teamspace', async () => {
    await expectToolError(
      createDocumentTool(contextFor(member), { title: 'Sub', parentId: 'doc-shared' }),
      'forbidden',
    )

    const result = await createDocumentTool(contextFor(editor), { title: 'Sub', parentId: 'doc-shared' })
    const created = await db.query.documents.findFirst({ where: eq(documents.id, result.id) })

    expect(created?.parentId).toBe('doc-shared')
    expect(created?.orgId).toBe(org)
  })

  it('creates nothing without the leaf:write scope', async () => {
    await expectToolError(
      createDocumentTool(contextFor(owner, readScopes), { title: 'Sem escopo' }),
      'write_disabled',
    )
  })

  it('creates the page from an HTML page, without the script and without the drawing', async () => {
    const result = await createDocumentTool(contextFor(member), {
      title: 'Artefato migrado',
      html: [
        '<style>body{color:red}</style>',
        '<script>fetch("https://example.com")</script>',
        '<h1>Artefato migrado</h1>',
        '<p>O texto <b>sobrevive</b>.</p>',
        '<svg viewBox="0 0 10 10"><text>o desenho</text></svg>',
        '<figcaption>a legenda sobrevive</figcaption>',
      ].join('\n'),
    })

    const created = await db.query.documents.findFirst({ where: eq(documents.id, result.id) })

    expect(created?.content).toContain('sobrevive')
    expect(created?.content).toContain('a legenda sobrevive')
    expect(created?.content).not.toContain('o desenho')
    expect(created?.content).not.toContain('fetch(')
    expect(created?.content).not.toContain('color:red')
  })

  it('refuses markdown and html in the same call, instead of picking one', async () => {
    await expectToolError(
      createDocumentTool(contextFor(member), {
        title: 'Os dois',
        markdown: 'texto',
        html: '<p>texto</p>',
      }),
      'invalid_argument',
    )
  })

  it('creates an empty page when no body comes in', async () => {
    const result = await createDocumentTool(contextFor(member), { title: 'Só o título' })
    const created = await db.query.documents.findFirst({ where: eq(documents.id, result.id) })

    expect(created?.content).toBeNull()
  })
})

describe('update_document', () => {
  it('appends markdown for an editor and refuses a reader', async () => {
    const result = await updateDocumentTool(contextFor(editor), {
      documentId: 'doc-shared',
      markdown: 'Linha nova.',
    })

    expect(result.written).toBe(true)

    const updated = await db.query.documents.findFirst({ where: eq(documents.id, 'doc-shared') })

    expect(updated?.content).toContain('Cronograma de leitura')
    expect(updated?.content).toContain('Linha nova.')

    await expectToolError(
      updateDocumentTool(contextFor(member), { documentId: 'doc-shared', markdown: 'x' }),
      'forbidden',
    )
  })

  it('substitui o corpo no modo replace', async () => {
    await updateDocumentTool(contextFor(owner), {
      documentId: 'doc-private',
      markdown: 'Só isto.',
      mode: 'replace',
    })

    const updated = await db.query.documents.findFirst({ where: eq(documents.id, 'doc-private') })

    expect(updated?.content).not.toContain('Segredo')
    expect(updated?.content).toContain('Só isto.')
  })

  it('refuses to write if the page was edited less than 15 s ago', async () => {
    await db
      .update(documents)
      .set({ updatedAt: new Date() })
      .where(eq(documents.id, 'doc-private'))

    await expectToolError(
      updateDocumentTool(contextFor(owner), { documentId: 'doc-private', markdown: 'x' }),
      'document_busy',
    )
  })

  it('edits no databases, and nothing without the write scope', async () => {
    await expectToolError(
      updateDocumentTool(contextFor(owner), { documentId: 'db-turmas', markdown: 'x' }),
      'invalid_argument',
    )
    await expectToolError(
      updateDocumentTool(contextFor(owner, readScopes), { documentId: 'doc-private', markdown: 'x' }),
      'write_disabled',
    )
  })

  it('replaces the body with an HTML page', async () => {
    await updateDocumentTool(contextFor(owner), {
      documentId: 'doc-private',
      html: '<h2>Migrado</h2><p>O texto sobrevive.</p><svg><text>o desenho</text></svg>',
      mode: 'replace',
    })

    const updated = await db.query.documents.findFirst({ where: eq(documents.id, 'doc-private') })

    expect(updated?.content).toContain('O texto sobrevive.')
    expect(updated?.content).not.toContain('o desenho')
    expect(updated?.content).not.toContain('Segredo')
  })

  it('refuses a call without markdown and without html', async () => {
    await expectToolError(
      updateDocumentTool(contextFor(owner), { documentId: 'doc-private' }),
      'invalid_argument',
    )
  })
})

async function connectedClient(context: McpToolContext) {
  const server = createLeafMcpServer(context)
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'teste', version: '0.0.0' })

  await server.connect(serverTransport)
  await client.connect(clientTransport)

  return { client, close: () => Promise.all([client.close(), server.close()]) }
}

describe('servidor MCP', () => {
  it('registers the write tools only when the token carries leaf:write', async () => {
    const readOnly = await connectedClient(contextFor(owner, readScopes))
    const readNames = (await readOnly.client.listTools()).tools.map((tool) => tool.name).sort()

    await readOnly.close()

    expect(readNames).toEqual([
      'get_database',
      'get_document',
      'list_comments',
      'list_documents',
      'list_organizations',
      'search_documents',
    ])

    const writable = await connectedClient(contextFor(owner))
    const writeNames = (await writable.client.listTools()).tools.map((tool) => tool.name)

    await writable.close()

    expect(writeNames).toContain('create_document')
    expect(writeNames).toContain('update_document')
  })

  it('returns a generic error with isError for an unreachable document', async () => {
    const { client, close } = await connectedClient(contextFor(stranger, readScopes))
    const result = await client.callTool({ name: 'get_document', arguments: { documentId: 'doc-private' } })

    await close()

    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain('not_found')
    expect(JSON.stringify(result.content)).not.toContain('Segredo')
  })
})
