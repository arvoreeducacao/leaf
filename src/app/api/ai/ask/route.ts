import { streamText } from 'ai'

import { readAiConfig } from '@/lib/ai-config'
import {
  askSystemPrompt,
  buildAskContext,
  readAskQuestion,
  toAskSources,
} from '@/lib/ai-ask'
import { createAiModel } from '@/lib/ai-model'
import { getSession } from '@/lib/auth'
import { registerAiAttempt } from '@/lib/authz'
import {
  askTokens,
  searchAccessibleDocumentBodies,
} from '@/lib/search-index'

export const askSourcesHeader = 'x-leaf-sources'

export async function POST(request: Request) {
  const config = readAiConfig(process.env)

  if (config === null) {
    return Response.json({ error: 'ai-disabled' }, { status: 503 })
  }

  const session = await getSession()

  if (!session) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    question?: unknown
  } | null
  const question = readAskQuestion(body?.question)

  if (question === null) {
    return Response.json({ error: 'bad-request' }, { status: 400 })
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

  const passages = await searchAccessibleDocumentBodies(
    { userId: session.user.id, email: session.user.email },
    question,
  )
  const sources = toAskSources(passages, askTokens(question))
  const header = Buffer.from(
    JSON.stringify(sources.map(({ id, title }) => ({ id, title }))),
  ).toString('base64')

  if (sources.length === 0) {
    return new Response('', {
      headers: {
        [askSourcesHeader]: header,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    })
  }

  const result = streamText({
    model: createAiModel(config),
    system: askSystemPrompt,
    prompt: `${buildAskContext(sources)}\n\nQuestion: ${question}`,
    maxOutputTokens: config.maxOutputTokens,
  })

  return result.toTextStreamResponse({
    headers: { [askSourcesHeader]: header },
  })
}
