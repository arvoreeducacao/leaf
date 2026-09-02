import {
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from '@blocknote/xl-ai/server'
import type { UIMessage } from 'ai'
import { convertToModelMessages, streamText } from 'ai'

import { readAiConfig } from '@/lib/ai-config'
import { aiSystemPrompt, createAiModel } from '@/lib/ai-model'
import { getSession } from '@/lib/auth'
import { canEdit, getDocumentAccess, registerAiAttempt } from '@/lib/authz'

type RequestBody = Readonly<{
  documentId?: unknown
  messages?: unknown
  toolDefinitions?: unknown
}>

type ToolDefinitions = Parameters<typeof toolDefinitionsToToolSet>[0]

function readToolDefinitions(value: unknown): ToolDefinitions | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const entries = Object.values(value)

  if (entries.length === 0) {
    return null
  }

  return value as ToolDefinitions
}

export async function POST(request: Request) {
  const config = readAiConfig(process.env)

  if (config === null) {
    return Response.json({ error: 'ai-disabled' }, { status: 503 })
  }

  const session = await getSession()

  if (!session) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null
  const documentId =
    typeof body?.documentId === 'string' ? body.documentId : null
  const messages = Array.isArray(body?.messages)
    ? (body.messages as Array<UIMessage>)
    : null
  const toolDefinitions = readToolDefinitions(body?.toolDefinitions)

  if (!documentId || !messages || !toolDefinitions) {
    return Response.json({ error: 'bad-request' }, { status: 400 })
  }

  const access = await getDocumentAccess(documentId, session)

  if (!canEdit(access)) {
    return Response.json({ error: 'forbidden' }, { status: 403 })
  }

  const attempt = registerAiAttempt(session.user.id)

  if (!attempt.allowed) {
    return Response.json(
      { error: 'rate-limited' },
      {
        status: 429,
        headers: { 'Retry-After': String(attempt.retryAfterSeconds) },
      },
    )
  }

  const result = streamText({
    model: createAiModel(config),
    system: aiSystemPrompt,
    messages: await convertToModelMessages(
      injectDocumentStateMessages(messages),
    ),
    tools: toolDefinitionsToToolSet(toolDefinitions),
    toolChoice: 'required',
    maxOutputTokens: config.maxOutputTokens,
  })

  return result.toUIMessageStreamResponse()
}
