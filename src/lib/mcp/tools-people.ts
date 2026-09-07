import { eq } from 'drizzle-orm'

import { db } from '@/db'
import { user } from '@/db/schema'
import { canComment, canEdit, registerCommentAttempt } from '@/lib/authz'
import {
  createComment,
  getComment,
  normalizeCommentBody,
  setCommentResolved,
} from '@/lib/comments'
import { authIssuer } from '@/lib/mcp-config'
import { invalid } from '@/lib/mcp/row-values'
import {
  MAX_MCP_IMAGE_BYTES,
  type McpToolContext,
  McpToolError,
  documentUrl,
  mcpImageTypes,
  requireReadable,
  requireWrite,
} from '@/lib/mcp/tools'
import {
  canManageOrganization,
  listMemberships,
  listOrganizationPeople,
} from '@/lib/organizations'
import { listVisibleTeamspaces } from '@/lib/teamspaces'
import {
  decodeBase64,
  looksLikeType,
  sanitizeSvg,
  storeUpload,
} from '@/lib/uploads'

export const MAX_MCP_COMMENT_CHARS = 4_000
export const MAX_MCP_FILE_BYTES = MAX_MCP_IMAGE_BYTES
export const MAX_MCP_MEMBERS = 500

export const mcpDocumentTypes = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/json',
] as const

export const mcpFileTypes = [...mcpImageTypes, ...mcpDocumentTypes] as const

const pdfMagic = [0x25, 0x50, 0x44, 0x46]

function looksLikeDocument(bytes: Buffer, contentType: string) {
  if (contentType === 'application/pdf') {
    return pdfMagic.every((byte, index) => bytes[index] === byte)
  }

  return true
}

export async function createCommentTool(
  context: McpToolContext,
  args: Readonly<{
    documentId: string
    body: string
    blockId?: string
    replyTo?: string
  }>,
) {
  requireWrite(context)

  const { access, document } = await requireReadable(args.documentId, context)

  if (!canComment(access)) {
    throw new McpToolError('forbidden', 'cannot comment on this document')
  }

  const body = normalizeCommentBody(args.body)

  if (body.length === 0) {
    invalid('the comment is empty')
  }

  if (body.length > MAX_MCP_COMMENT_CHARS) {
    invalid(`the comment is longer than ${MAX_MCP_COMMENT_CHARS} characters`)
  }

  const userId = context.session.user.id
  const decision = registerCommentAttempt(`${document.id}:${userId}`)

  if (!decision.allowed) {
    throw new McpToolError('rate_limited', 'too many comments in a row')
  }

  const id = await createComment({
    documentId: document.id,
    authorId: userId,
    body,
    blockId: args.blockId ?? null,
    parentId: args.replyTo ?? null,
  })

  if (!id) {
    throw new McpToolError('not_found', 'comment thread not found')
  }

  context.onDocumentWritten?.(document.id)

  return {
    id,
    documentId: document.id,
    threadId: args.replyTo ?? id,
    url: documentUrl(document.id),
  }
}

export async function resolveCommentTool(
  context: McpToolContext,
  args: Readonly<{ documentId: string; commentId: string; resolved?: boolean }>,
) {
  requireWrite(context)

  const { access, document } = await requireReadable(args.documentId, context)
  const comment = await getComment(document.id, args.commentId)

  if (!comment || comment.parentId !== null) {
    throw new McpToolError('not_found', 'comment thread not found')
  }

  const isAuthor = comment.authorId === context.session.user.id

  if (!isAuthor && !canEdit(access)) {
    throw new McpToolError('forbidden', 'only the author or an editor can resolve it')
  }

  const resolved = args.resolved ?? true

  await setCommentResolved(comment.id, resolved)
  context.onDocumentWritten?.(document.id)

  return { id: comment.id, documentId: document.id, resolved }
}

export async function listTeamspacesTool(context: McpToolContext) {
  const userId = context.session.user.id
  const memberships = await listMemberships(userId)
  const teamspaces = []

  for (const membership of memberships) {
    const visible = await listVisibleTeamspaces(membership.orgId, userId)

    for (const teamspace of visible) {
      teamspaces.push({
        id: teamspace.id,
        name: teamspace.name,
        access: teamspace.access,
        member: teamspace.role !== null,
        role: teamspace.role,
        organizationId: membership.orgId,
        organizationName: membership.orgName,
      })
    }
  }

  return { teamspaces }
}

export async function listMembersTool(
  context: McpToolContext,
  args: Readonly<{ organizationId?: string }>,
) {
  const userId = context.session.user.id
  const memberships = await listMemberships(userId)
  const membership =
    args.organizationId === undefined
      ? memberships[0]
      : memberships.find((item) => item.orgId === args.organizationId)

  if (!membership) {
    throw new McpToolError('not_found', 'organization not found')
  }

  const manages = canManageOrganization(membership.role)
  const people = await listOrganizationPeople(membership.orgId)

  return {
    organizationId: membership.orgId,
    organizationName: membership.orgName,
    total: people.length,
    members: people.slice(0, MAX_MCP_MEMBERS).map((person) => ({
      id: person.userId,
      name: person.name,
      role: person.role,
      ...(manages || person.userId === userId ? { email: person.email } : {}),
    })),
  }
}

export async function whoamiTool(context: McpToolContext) {
  const userId = context.session.user.id
  const [profile, memberships] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, userId) }),
    listMemberships(userId),
  ])

  return {
    id: userId,
    name: profile?.name ?? null,
    email: context.session.user.email,
    organizations: memberships.map((membership) => ({
      id: membership.orgId,
      name: membership.orgName,
      role: membership.role,
    })),
    leafUrl: authIssuer(),
  }
}

export async function uploadFileTool(
  context: McpToolContext,
  args: Readonly<{ data: string; contentType: string; fileName?: string }>,
) {
  requireWrite(context)

  const contentType = args.contentType.trim().toLowerCase()

  if (!(mcpFileTypes as ReadonlyArray<string>).includes(contentType)) {
    invalid(`contentType must be one of ${mcpFileTypes.join(', ')}`)
  }

  const bytes = decodeBase64(args.data)

  if (!bytes) {
    invalid('data must be base64')
  }

  if (bytes.length > MAX_MCP_FILE_BYTES) {
    invalid(`the file is larger than ${MAX_MCP_FILE_BYTES} bytes`)
  }

  const isImage = (mcpImageTypes as ReadonlyArray<string>).includes(contentType)

  if (isImage ? !looksLikeType(bytes, contentType) : !looksLikeDocument(bytes, contentType)) {
    invalid(`those bytes are not ${contentType}`)
  }

  const safe =
    contentType === 'image/svg+xml'
      ? Buffer.from(sanitizeSvg(bytes.toString('utf8')), 'utf8')
      : bytes
  const stored = await storeUpload(safe, contentType)

  return {
    url: stored.url,
    absoluteUrl: `${authIssuer()}${stored.url}`,
    bytes: safe.length,
    contentType,
    fileName: args.fileName?.trim().slice(0, 200) || null,
  }
}
