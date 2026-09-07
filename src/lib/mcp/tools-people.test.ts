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
  documentShares,
  documents,
  organizationMembers,
  organizations,
  teamspaceMembers,
  teamspaces,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { resetCommentLimiter } from '@/lib/authz'
import { type McpToolContext, McpToolError } from '@/lib/mcp/tools'
import {
  createCommentTool,
  listMembersTool,
  listTeamspacesTool,
  resolveCommentTool,
  uploadFileTool,
  whoamiTool,
} from '@/lib/mcp/tools-people'

const owner = { id: 'pp-owner', email: 'dono@example.com' }
const commenter = { id: 'pp-commenter', email: 'comenta@example.com' }
const viewer = { id: 'pp-viewer', email: 'olha@example.com' }
const stranger = { id: 'pp-stranger', email: 'fora@example.com' }

const org = 'org-pp'
const teamspace = 'ts-pp'
const readScopes = ['leaf:read', 'offline_access']
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

beforeEach(async () => {
  await resetDatabase()
  resetCommentLimiter()
  stored.length = 0

  await db.insert(user).values(
    [owner, commenter, viewer, stranger].map((person) => ({
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
    { id: 'ppm1', orgId: org, userId: owner.id, role: 'owner', createdAt: longAgo },
    { id: 'ppm2', orgId: org, userId: commenter.id, role: 'member', createdAt: longAgo },
    { id: 'ppm3', orgId: org, userId: viewer.id, role: 'member', createdAt: longAgo },
  ])
  await db.insert(teamspaces).values([
    { id: teamspace, orgId: org, name: 'Pedagógico', access: 'open', createdAt: longAgo },
    { id: 'ts-closed', orgId: org, name: 'Diretoria', access: 'closed', createdAt: longAgo },
  ])
  await db.insert(teamspaceMembers).values({ id: 'pptm1', teamspaceId: 'ts-closed', userId: owner.id, role: 'owner', createdAt: longAgo })

  await db.insert(documents).values({ id: 'pp-doc', ownerId: owner.id, orgId: org, title: 'Ata', createdAt: longAgo, updatedAt: longAgo })
  await db.insert(documentShares).values([
    { id: 'pps1', documentId: 'pp-doc', granteeEmail: commenter.email, role: 'commenter', createdAt: longAgo },
    { id: 'pps2', documentId: 'pp-doc', granteeEmail: viewer.email, role: 'viewer', createdAt: longAgo },
  ])
})

describe('create_comment and resolve_comment', () => {
  it('opens a thread, replies to it and resolves it with the right permissions', async () => {
    const thread = await createCommentTool(contextFor(commenter), {
      documentId: 'pp-doc',
      body: 'Falta a data da reunião.',
    })

    expect(thread.threadId).toBe(thread.id)

    const reply = await createCommentTool(contextFor(owner), {
      documentId: 'pp-doc',
      body: 'Colocada.',
      replyTo: thread.id,
    })

    expect(reply.threadId).toBe(thread.id)

    const rows = await db.select().from(comments).where(eq(comments.documentId, 'pp-doc'))

    expect(rows).toHaveLength(2)

    expect(
      await failure(createCommentTool(contextFor(viewer), { documentId: 'pp-doc', body: 'x' })),
    ).toBe('forbidden')

    expect(
      await failure(createCommentTool(contextFor(stranger), { documentId: 'pp-doc', body: 'x' })),
    ).toBe('not_found')

    expect(
      await failure(createCommentTool(contextFor(commenter, readScopes), { documentId: 'pp-doc', body: 'x' })),
    ).toBe('write_disabled')

    expect(
      await failure(resolveCommentTool(contextFor(viewer), { documentId: 'pp-doc', commentId: thread.id })),
    ).toBe('forbidden')

    const resolved = await resolveCommentTool(contextFor(commenter), {
      documentId: 'pp-doc',
      commentId: thread.id,
    })

    expect(resolved.resolved).toBe(true)

    const stored = await db.query.comments.findFirst({ where: eq(comments.id, thread.id) })

    expect(stored?.resolvedAt).not.toBeNull()

    const reopened = await resolveCommentTool(contextFor(owner), {
      documentId: 'pp-doc',
      commentId: thread.id,
      resolved: false,
    })

    expect(reopened.resolved).toBe(false)

    expect(
      await failure(resolveCommentTool(contextFor(owner), { documentId: 'pp-doc', commentId: reply.id })),
    ).toBe('not_found')
  })
})

describe('list_teamspaces, list_members and whoami', () => {
  it('shows what the person can see, with emails only for managers', async () => {
    const forOwner = await listTeamspacesTool(contextFor(owner, readScopes))

    expect(forOwner.teamspaces.map((item) => [item.name, item.member]).sort()).toEqual([
      ['Diretoria', true],
      ['Pedagógico', false],
    ])

    const forViewer = await listTeamspacesTool(contextFor(viewer, readScopes))

    expect(forViewer.teamspaces.map((item) => item.name)).toEqual(['Pedagógico'])

    const managed = await listMembersTool(contextFor(owner, readScopes), {})

    expect(managed.total).toBe(3)
    expect(managed.members.every((member) => typeof member.email === 'string')).toBe(true)

    const plain = await listMembersTool(contextFor(viewer, readScopes), {})
    const others = plain.members.filter((member) => member.id !== viewer.id)

    expect(others.every((member) => member.email === undefined)).toBe(true)
    expect(plain.members.find((member) => member.id === viewer.id)?.email).toBe(viewer.email)

    expect(
      await failure(listMembersTool(contextFor(stranger, readScopes), {})),
    ).toBe('not_found')

    const me = await whoamiTool(contextFor(commenter, readScopes))

    expect(me.email).toBe(commenter.email)
    expect(me.organizations).toEqual([{ id: org, name: 'Escola', role: 'member' }])
  })
})

describe('upload_file', () => {
  it('stores a PDF and a CSV and refuses what is not the declared type', async () => {
    const pdf = await uploadFileTool(contextFor(owner), {
      data: Buffer.from('%PDF-1.4 fake').toString('base64'),
      contentType: 'application/pdf',
      fileName: 'ata.pdf',
    })

    expect(pdf.url).toMatch(/^\/api\/uploads\/u\//)
    expect(pdf.fileName).toBe('ata.pdf')
    expect(stored[0]?.contentType).toBe('application/pdf')

    const csv = await uploadFileTool(contextFor(owner), {
      data: Buffer.from('nome,turma\nAna,6A').toString('base64'),
      contentType: 'text/csv',
    })

    expect(csv.bytes).toBe(17)

    expect(
      await failure(
        uploadFileTool(contextFor(owner), {
          data: Buffer.from('nada de pdf').toString('base64'),
          contentType: 'application/pdf',
        }),
      ),
    ).toBe('invalid_argument')

    expect(
      await failure(
        uploadFileTool(contextFor(owner), { data: 'AAAA', contentType: 'application/x-msdownload' }),
      ),
    ).toBe('invalid_argument')

    expect(
      await failure(
        uploadFileTool(contextFor(owner, readScopes), { data: 'AAAA', contentType: 'text/plain' }),
      ),
    ).toBe('write_disabled')
  })
})
