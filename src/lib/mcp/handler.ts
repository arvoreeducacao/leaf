import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'

import { db } from '@/db'
import { user } from '@/db/schema'
import { createRateLimiter } from '@/lib/authz'
import {
  isMcpEnabled,
  mcpAllowedHosts,
  mcpResourceUrl,
  protectedResourceMetadataUrl,
} from '@/lib/mcp-config'
import { mcpNotFound } from '@/lib/mcp/discovery'
import { createLeafMcpServer } from '@/lib/mcp/server'
import { verifyMcpAccessToken } from '@/lib/mcp/token'

export const MAX_MCP_BODY_BYTES = 1_000_000

const noStore = { 'Cache-Control': 'no-store' }

const mcpLimiter = createRateLimiter(60_000, 60)

export function registerMcpAttempt(userId: string, now: number = Date.now()) {
  return mcpLimiter.register(userId, now)
}

export function resetMcpLimiter() {
  mcpLimiter.reset()
}

function bearerToken(request: Request) {
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim())

  return match ? match[1] : null
}

function unauthorized() {
  return Response.json(
    { error: 'invalid_token' },
    {
      status: 401,
      headers: {
        ...noStore,
        'WWW-Authenticate': `Bearer error="invalid_token", resource_metadata="${protectedResourceMetadataUrl()}"`,
      },
    },
  )
}

function methodNotAllowed() {
  return Response.json(
    { error: 'method-not-allowed' },
    { status: 405, headers: { ...noStore, Allow: 'POST' } },
  )
}

function tooLarge() {
  return Response.json({ error: 'payload-too-large' }, { status: 413, headers: noStore })
}

function badRequest() {
  return Response.json({ error: 'bad-request' }, { status: 400, headers: noStore })
}

function tooManyRequests(retryAfterSeconds: number) {
  return Response.json(
    { error: 'rate-limited' },
    {
      status: 429,
      headers: { ...noStore, 'Retry-After': String(retryAfterSeconds) },
    },
  )
}

async function readJsonBody(request: Request): Promise<unknown | null> {
  const declared = Number(request.headers.get('content-length') ?? '0')

  if (Number.isFinite(declared) && declared > MAX_MCP_BODY_BYTES) {
    return null
  }

  const text = await request.text()

  if (Buffer.byteLength(text, 'utf8') > MAX_MCP_BODY_BYTES) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

function withNoStore(response: Response) {
  const headers = new Headers(response.headers)

  headers.set('Cache-Control', 'no-store')

  return new Response(response.body, { status: response.status, headers })
}

function revalidateDocument(documentId: string) {
  try {
    revalidatePath('/', 'layout')
    revalidatePath(`/doc/${documentId}`)
  } catch {
    return
  }
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  if (!isMcpEnabled()) {
    return mcpNotFound()
  }

  if (request.method !== 'POST') {
    return methodNotAllowed()
  }

  const token = bearerToken(request)

  if (!token) {
    return unauthorized()
  }

  const verification = await verifyMcpAccessToken(token)

  if (verification.status !== 'ok') {
    return unauthorized()
  }

  const { access } = verification
  const decision = registerMcpAttempt(access.userId)

  if (!decision.allowed) {
    return tooManyRequests(decision.retryAfterSeconds)
  }

  const account = await db.query.user.findFirst({
    columns: { id: true, email: true },
    where: eq(user.id, access.userId),
  })

  if (!account) {
    return unauthorized()
  }

  const parsedBody = await readJsonBody(request)

  if (parsedBody === null) {
    return tooLarge()
  }

  if (parsedBody === undefined) {
    return badRequest()
  }

  const server = createLeafMcpServer({
    session: { user: { id: account.id, email: account.email } },
    scopes: access.scopes,
    clientId: access.clientId,
    onDocumentWritten: revalidateDocument,
  })

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    allowedHosts: mcpAllowedHosts(),
    enableDnsRebindingProtection: true,
  })

  await server.connect(transport)

  try {
    const response = await transport.handleRequest(request, {
      parsedBody,
      authInfo: {
        token: access.token,
        clientId: access.clientId,
        scopes: [...access.scopes],
        expiresAt: access.expiresAt,
        resource: new URL(mcpResourceUrl()),
        extra: { userId: account.id },
      },
    })

    return withNoStore(response)
  } finally {
    await transport.close()
  }
}
