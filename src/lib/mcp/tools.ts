import { and, desc, eq, isNull, notInArray } from 'drizzle-orm'
import { nanoid } from 'nanoid'

import { db } from '@/db'
import { documents } from '@/db/schema'
import type { Document } from '@/db/schema'
import { canEdit, getDocumentAccess } from '@/lib/authz'
import type { AccessLevel } from '@/lib/authz'
import { normalizeCover } from '@/lib/document-cover'
import { normalizeDocumentIcon } from '@/lib/document-icon'
import { UNLISTED_DOCUMENT_KINDS } from '@/lib/document-kinds'
import { listDocumentComments } from '@/lib/comments'
import { personOptions } from '@/lib/database/people'
import { parseOptions, valueOf, valueToText } from '@/lib/database/values'
import { loadDatabase, loadRowContext } from '@/lib/databases'
import { persistDocumentContentIfUnchanged } from '@/lib/document-content'
import {
  getDocument,
  listOwnedDocuments,
  listSharedDocuments,
} from '@/lib/documents'
import type { DocumentSummary } from '@/lib/documents'
import {
  contentToMarkdown,
  htmlToBlocks,
  markdownToBlocks,
  parseContentBlocks,
} from '@/lib/markdown/convert'
import {
  authIssuer,
  isMcpWriteEnabled,
  mcpWriteScope,
} from '@/lib/mcp-config'
import {
  canManageOrganization,
  getMembership,
  listMemberships,
  listOrganizationDocuments,
  listOrganizationPeople,
} from '@/lib/organizations'
import { isDocumentIdShaped } from '@/lib/realtime'
import { searchDocumentsHybrid } from '@/lib/search-hybrid'
import { scheduleSearchIndexReconcile } from '@/lib/search-index'
import {
  listTeamspaceDocuments,
  listTeamspacesForOrganization,
  listVisibleTeamspaces,
} from '@/lib/teamspaces'
import {
  decodeBase64,
  looksLikeType,
  sanitizeSvg,
  storeUpload,
} from '@/lib/uploads'

export const MAX_MCP_RESULTS = 50
export const MAX_MCP_MARKDOWN_CHARS = 400_000
export const MAX_MCP_HTML_CHARS = 600_000
export const MAX_MCP_IMAGE_BYTES = 500_000
export const MAX_MCP_TITLE_CHARS = 200
export const MCP_LIVE_EDIT_WINDOW_MS = 15_000

export const mcpImageTypes = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/svg+xml',
] as const

export type McpToolErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'invalid_argument'
  | 'document_busy'
  | 'conflict'
  | 'write_disabled'

export class McpToolError extends Error {
  constructor(
    readonly code: McpToolErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'McpToolError'
  }
}

export type McpToolContext = Readonly<{
  session: Readonly<{ user: Readonly<{ id: string; email: string }> }>
  scopes: ReadonlyArray<string>
  clientId: string
  locale?: string
  onDocumentWritten?: (documentId: string) => void
}>

export function canWrite(context: McpToolContext) {
  return isMcpWriteEnabled() && context.scopes.includes(mcpWriteScope)
}

export function documentUrl(id: string) {
  return `${authIssuer()}/doc/${id}`
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function requireDocumentId(value: string) {
  if (!isDocumentIdShaped(value)) {
    throw new McpToolError('invalid_argument', 'documentId is malformed')
  }

  return value
}

export function requireWrite(context: McpToolContext) {
  if (!canWrite(context)) {
    throw new McpToolError('write_disabled', 'writing is not available')
  }
}

export function clampLimit(limit: number | undefined, fallback: number) {
  if (limit === undefined || !Number.isFinite(limit)) {
    return fallback
  }

  return Math.min(MAX_MCP_RESULTS, Math.max(1, Math.trunc(limit)))
}

export async function requireReadable(
  documentId: string,
  context: McpToolContext,
): Promise<{ access: AccessLevel; document: Document }> {
  const id = requireDocumentId(documentId)
  const access = await getDocumentAccess(id, context.session)

  if (!access) {
    throw new McpToolError('not_found', 'document not found')
  }

  const document = await getDocument(id)

  if (!document || document.deletedAt) {
    throw new McpToolError('not_found', 'document not found')
  }

  return { access, document }
}

function summarize(document: Pick<Document, 'id' | 'title' | 'kind' | 'parentId' | 'updatedAt'>) {
  return {
    id: document.id,
    title: document.title,
    kind: document.kind,
    parentId: document.parentId,
    updatedAt: toIso(document.updatedAt),
    url: documentUrl(document.id),
  }
}

export async function searchDocuments(
  context: McpToolContext,
  args: Readonly<{ query: string; limit?: number }>,
) {
  const query = args.query.trim().slice(0, 200)
  const limit = clampLimit(args.limit, 20)

  if (query.length === 0) {
    return { results: [] }
  }

  scheduleSearchIndexReconcile()

  const hits = await searchDocumentsHybrid(
    { userId: context.session.user.id, email: context.session.user.email },
    query,
    limit,
  )

  return {
    results: hits.map((hit) => ({
      id: hit.id,
      title: hit.title,
      snippet: hit.segments.map((segment) => segment.text).join(''),
      url: documentUrl(hit.id),
    })),
  }
}

async function listAccessibleChildren(
  parentId: string,
  context: McpToolContext,
) {
  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      kind: documents.kind,
      parentId: documents.parentId,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(
      and(
        eq(documents.parentId, parentId),
        isNull(documents.deletedAt),
        notInArray(documents.kind, [...UNLISTED_DOCUMENT_KINDS]),
      ),
    )
    .orderBy(desc(documents.updatedAt))
    .limit(MAX_MCP_RESULTS)

  const visible = await Promise.all(
    rows.map(async (row) =>
      (await getDocumentAccess(row.id, context.session)) ? row : null,
    ),
  )

  return visible
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .map(summarize)
}

async function rowValues(rowId: string, viewerId: string, locale: string) {
  const row = await loadRowContext(rowId, viewerId)

  if (!row) {
    return null
  }

  const values: Record<string, string> = {}

  for (const property of row.properties) {
    const options =
      property.type === 'person'
        ? personOptions(row.people)
        : parseOptions(property.options)

    values[property.name] = valueToText(
      valueOf(row.row.values, property, options),
      property.type,
      options,
      locale,
    )
  }

  return { databaseId: row.databaseId, databaseTitle: row.databaseTitle, values }
}

export async function getDocumentTool(
  context: McpToolContext,
  args: Readonly<{ documentId: string }>,
) {
  const { access, document } = await requireReadable(args.documentId, context)
  const locale = context.locale ?? 'pt-BR'
  const children = await listAccessibleChildren(document.id, context)
  const markdown =
    document.kind === 'database'
      ? ''
      : await contentToMarkdown(document.content, authIssuer())
  const row =
    document.kind === 'row'
      ? await rowValues(document.id, context.session.user.id, locale)
      : null

  return {
    ...summarize(document),
    access,
    orgId: document.orgId,
    teamspaceId: document.teamspaceId,
    orgAccess: document.orgAccess,
    createdAt: toIso(document.createdAt),
    markdown,
    ...(row ? { database: { id: row.databaseId, title: row.databaseTitle }, properties: row.values } : {}),
    children,
  }
}

type ListedDocument = ReturnType<typeof summarize> &
  Readonly<{ source: 'own' | 'shared' | 'organization' | 'teamspace'; organization?: string; teamspace?: string }>

function fromSummary(
  summary: DocumentSummary,
  extra: Omit<ListedDocument, keyof ReturnType<typeof summarize>>,
): ListedDocument {
  return { ...summarize(summary), ...extra }
}

export async function listDocumentsTool(
  context: McpToolContext,
  args: Readonly<{ limit?: number }>,
) {
  const { id: userId, email } = context.session.user
  const limit = clampLimit(args.limit, MAX_MCP_RESULTS)
  const seen = new Set<string>()
  const listed: Array<ListedDocument> = []

  function push(items: Array<ListedDocument>) {
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        listed.push(item)
      }
    }
  }

  push(
    (await listOwnedDocuments(userId)).map((item) =>
      fromSummary(item, { source: 'own' }),
    ),
  )
  push(
    (await listSharedDocuments(email)).map((item) =>
      fromSummary(item, { source: 'shared' }),
    ),
  )

  for (const membership of await listMemberships(userId)) {
    push(
      (await listOrganizationDocuments(membership.orgId)).map((item) =>
        fromSummary(item, {
          source: 'organization',
          organization: membership.orgName,
        }),
      ),
    )

    const teamspaces = await listTeamspacesForOrganization(
      membership.orgId,
      userId,
    )

    for (const teamspace of teamspaces.filter((item) => item.role !== null)) {
      push(
        (await listTeamspaceDocuments(teamspace.id)).map((item) =>
          fromSummary(item, {
            source: 'teamspace',
            organization: membership.orgName,
            teamspace: teamspace.name,
          }),
        ),
      )
    }
  }

  listed.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  return { total: listed.length, documents: listed.slice(0, limit) }
}

export async function listOrganizationsTool(context: McpToolContext) {
  const userId = context.session.user.id
  const memberships = await listMemberships(userId)

  const organizations = await Promise.all(
    memberships.map(async (membership) => {
      const [people, teamspaces] = await Promise.all([
        listOrganizationPeople(membership.orgId),
        listVisibleTeamspaces(membership.orgId, userId),
      ])
      const manages = canManageOrganization(membership.role)

      return {
        id: membership.orgId,
        name: membership.orgName,
        role: membership.role,
        members: people.map((person) => ({
          id: person.userId,
          name: person.name,
          role: person.role,
          ...(manages ? { email: person.email } : {}),
        })),
        teamspaces: teamspaces.map((teamspace) => ({
          id: teamspace.id,
          name: teamspace.name,
          access: teamspace.access,
          member: teamspace.role !== null,
        })),
      }
    }),
  )

  return { organizations }
}

export async function getDatabaseTool(
  context: McpToolContext,
  args: Readonly<{ databaseId: string; limit?: number; offset?: number }>,
) {
  const { document } = await requireReadable(args.databaseId, context)

  if (document.kind !== 'database') {
    throw new McpToolError('not_found', 'database not found')
  }

  const snapshot = await loadDatabase(document.id, context.session.user.id)

  if (!snapshot) {
    throw new McpToolError('not_found', 'database not found')
  }

  const locale = context.locale ?? 'pt-BR'
  const limit = clampLimit(args.limit, MAX_MCP_RESULTS)
  const offset = Math.max(0, Math.trunc(args.offset ?? 0))
  const optionsByProperty = new Map(
    snapshot.properties.map((property) => [
      property.id,
      property.type === 'person'
        ? personOptions(snapshot.people)
        : parseOptions(property.options),
    ]),
  )

  return {
    id: snapshot.id,
    title: snapshot.title,
    url: documentUrl(snapshot.id),
    properties: snapshot.properties.map((property) => ({
      id: property.id,
      name: property.name,
      type: property.type,
      options: (optionsByProperty.get(property.id) ?? []).map(
        (option) => option.name,
      ),
    })),
    views: snapshot.views.map((view) => ({
      id: view.id,
      name: view.name,
      type: view.type,
    })),
    totalRows: snapshot.rows.length,
    offset,
    rows: snapshot.rows.slice(offset, offset + limit).map((row) => ({
      id: row.id,
      title: row.title,
      url: documentUrl(row.id),
      updatedAt: row.updatedAt,
      values: Object.fromEntries(
        snapshot.properties.map((property) => [
          property.name,
          valueToText(
            valueOf(row.values, property, optionsByProperty.get(property.id)),
            property.type,
            optionsByProperty.get(property.id) ?? [],
            locale,
          ),
        ]),
      ),
    })),
  }
}

export async function listCommentsTool(
  context: McpToolContext,
  args: Readonly<{ documentId: string }>,
) {
  const { document } = await requireReadable(args.documentId, context)
  const threads = await listDocumentComments(document.id)

  return {
    documentId: document.id,
    threads: threads.slice(0, MAX_MCP_RESULTS).map((thread) => ({
      id: thread.id,
      blockId: thread.blockId,
      author: thread.authorName,
      body: thread.body,
      createdAt: new Date(thread.createdAt).toISOString(),
      resolved: thread.resolvedAt !== null,
      replies: thread.replies.map((reply) => ({
        id: reply.id,
        author: reply.authorName,
        body: reply.body,
        createdAt: new Date(reply.createdAt).toISOString(),
      })),
    })),
  }
}

function requireMarkdown(markdown: string) {
  if (markdown.length > MAX_MCP_MARKDOWN_CHARS) {
    throw new McpToolError('invalid_argument', 'markdown is too long')
  }

  return markdown
}

function requireHtml(html: string) {
  if (html.length > MAX_MCP_HTML_CHARS) {
    throw new McpToolError('invalid_argument', 'html is too long')
  }

  return html
}

type WrittenBody = Readonly<{ markdown?: string; html?: string }>

export async function blocksOf(body: WrittenBody, required: boolean) {
  const markdown = body.markdown ?? ''
  const html = body.html ?? ''

  if (markdown.length > 0 && html.length > 0) {
    throw new McpToolError(
      'invalid_argument',
      'send either markdown or html, not both',
    )
  }

  if (html.length > 0) {
    return htmlToBlocks(requireHtml(html))
  }

  if (markdown.length > 0) {
    return markdownToBlocks(requireMarkdown(markdown))
  }

  if (required) {
    throw new McpToolError('invalid_argument', 'markdown or html is required')
  }

  return []
}

export async function uploadImageTool(
  context: McpToolContext,
  args: Readonly<{ data: string; contentType: string }>,
) {
  requireWrite(context)

  const contentType = args.contentType.trim().toLowerCase()

  if (!(mcpImageTypes as ReadonlyArray<string>).includes(contentType)) {
    throw new McpToolError(
      'invalid_argument',
      `contentType must be one of ${mcpImageTypes.join(', ')}`,
    )
  }

  const bytes = decodeBase64(args.data)

  if (!bytes) {
    throw new McpToolError('invalid_argument', 'data must be a base64 image')
  }

  if (bytes.length > MAX_MCP_IMAGE_BYTES) {
    throw new McpToolError(
      'invalid_argument',
      `the image is larger than ${MAX_MCP_IMAGE_BYTES} bytes`,
    )
  }

  if (!looksLikeType(bytes, contentType)) {
    throw new McpToolError(
      'invalid_argument',
      `those bytes are not ${contentType}`,
    )
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
  }
}

function iconValueOf(icon: string | null | undefined) {
  if (icon === undefined) {
    return undefined
  }

  if (icon === null || icon.trim().length === 0) {
    return null
  }

  const value = normalizeDocumentIcon(icon)

  if (!value) {
    throw new McpToolError('invalid_argument', 'icon must be an emoji or an image address')
  }

  return value
}

function coverValueOf(cover: string | null | undefined) {
  if (cover === undefined) {
    return undefined
  }

  if (cover === null || cover.trim().length === 0) {
    return null
  }

  const value = normalizeCover(cover)

  if (!value) {
    throw new McpToolError('invalid_argument', 'cover must be an https image address or a gradient')
  }

  return value
}

export async function createDocumentTool(
  context: McpToolContext,
  args: Readonly<{
    title: string
    markdown?: string
    html?: string
    parentId?: string
    icon?: string | null
    cover?: string | null
  }>,
) {
  requireWrite(context)

  const title = args.title.trim().slice(0, MAX_MCP_TITLE_CHARS)

  if (title.length === 0) {
    throw new McpToolError('invalid_argument', 'title is required')
  }

  const icon = iconValueOf(args.icon) ?? null
  const cover = coverValueOf(args.cover) ?? null

  const blocks = await blocksOf(args, false)
  const userId = context.session.user.id
  let parent: Document | null = null

  if (args.parentId !== undefined) {
    const parentId = requireDocumentId(args.parentId)
    const access = await getDocumentAccess(parentId, context.session)

    if (!canEdit(access)) {
      throw new McpToolError('forbidden', 'cannot create inside this document')
    }

    parent = await getDocument(parentId)

    if (!parent || parent.kind === 'database') {
      throw new McpToolError('invalid_argument', 'parent must be a page')
    }
  }

  const membership = parent ? null : await getMembership(userId)
  const id = nanoid(12)
  const now = new Date()

  await db.insert(documents).values({
    id,
    ownerId: userId,
    parentId: parent?.id ?? null,
    orgId: parent ? parent.orgId : (membership?.orgId ?? null),
    teamspaceId: parent?.teamspaceId ?? null,
    orgAccess: parent?.orgAccess ?? null,
    kind: 'page',
    title,
    icon,
    cover,
    content: blocks.length > 0 ? JSON.stringify(blocks) : null,
    createdAt: now,
    updatedAt: now,
  })

  const { indexDocument } = await import('@/lib/search-index')

  await indexDocument(id)
  context.onDocumentWritten?.(id)

  return { id, title, parentId: parent?.id ?? null, icon, cover, url: documentUrl(id) }
}

export async function updateDocumentTool(
  context: McpToolContext,
  args: Readonly<{
    documentId: string
    markdown?: string
    html?: string
    mode?: 'append' | 'replace'
    title?: string
    icon?: string | null
    cover?: string | null
    values?: Readonly<Record<string, unknown>>
  }>,
  now: Date = new Date(),
) {
  requireWrite(context)

  const id = requireDocumentId(args.documentId)
  const access = await getDocumentAccess(id, context.session)

  if (!canEdit(access)) {
    throw new McpToolError('forbidden', 'cannot edit this document')
  }

  const document = await getDocument(id)

  if (!document || document.deletedAt) {
    throw new McpToolError('not_found', 'document not found')
  }

  const hasBody = (args.markdown?.length ?? 0) > 0 || (args.html?.length ?? 0) > 0
  const changes: {
    title?: string
    icon?: string | null
    cover?: string | null
    coverCredit?: string | null
    properties?: string
  } = {}

  if (args.title !== undefined) {
    const title = args.title.trim().slice(0, MAX_MCP_TITLE_CHARS)

    if (title.length === 0) {
      throw new McpToolError('invalid_argument', 'title cannot be empty')
    }

    changes.title = title
  }

  const icon = iconValueOf(args.icon)

  if (icon !== undefined) {
    changes.icon = icon
  }

  const cover = coverValueOf(args.cover)

  if (cover !== undefined) {
    changes.cover = cover
    changes.coverCredit = null
  }

  if (args.values !== undefined && Object.keys(args.values).length > 0) {
    if (document.kind !== 'row' || !document.parentId) {
      throw new McpToolError('invalid_argument', 'values only apply to database rows')
    }

    const { valuesFrom } = await import('@/lib/mcp/row-values')
    const { listDatabaseProperties } = await import('@/lib/databases')
    const properties = await listDatabaseProperties(document.parentId)
    const incoming = await valuesFrom(
      args.values,
      properties,
      document.orgId,
      context.session.user.id,
    )
    const { parseValues, serializeValues } = await import('@/lib/database/values')

    changes.properties = serializeValues({
      ...parseValues(document.properties),
      ...incoming,
    })
  }

  if (!hasBody && Object.keys(changes).length === 0) {
    throw new McpToolError(
      'invalid_argument',
      'send a body, a title, an icon, a cover or values',
    )
  }

  let written = false

  if (hasBody) {
    if (document.kind === 'database') {
      throw new McpToolError('invalid_argument', 'databases have no body to edit')
    }

    if (now.getTime() - document.updatedAt.getTime() < MCP_LIVE_EDIT_WINDOW_MS) {
      throw new McpToolError(
        'document_busy',
        'document was edited moments ago; retry in a few seconds',
      )
    }

    const mode = args.mode ?? 'append'
    const incoming = await blocksOf(args, true)
    const blocks =
      mode === 'append'
        ? [...parseContentBlocks(document.content), ...incoming]
        : incoming

    const outcome = await persistDocumentContentIfUnchanged(
      id,
      JSON.stringify(blocks),
      context.session.user.id,
      document.updatedAt,
    )

    if (outcome === 'conflict') {
      throw new McpToolError('conflict', 'document changed while writing; retry')
    }

    if (outcome === 'missing') {
      throw new McpToolError('not_found', 'document not found')
    }

    written = outcome === 'written'
  }

  if (Object.keys(changes).length > 0) {
    await db
      .update(documents)
      .set({ ...changes, updatedAt: new Date() })
      .where(eq(documents.id, id))

    if (changes.title !== undefined) {
      const { indexDocument } = await import('@/lib/search-index')

      await indexDocument(id)
    }

    written = true
  }

  if (written) {
    context.onDocumentWritten?.(id)
  }

  return {
    id,
    mode: hasBody ? (args.mode ?? 'append') : null,
    written,
    updated: Object.keys(changes).filter((key) => key !== 'coverCredit'),
    url: documentUrl(id),
  }
}
