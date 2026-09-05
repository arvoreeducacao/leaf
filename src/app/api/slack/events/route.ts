import { NextResponse } from 'next/server'

import { slackSigningSecret } from '@/lib/slack/config'
import { challengeOf, parseMessageEvent } from '@/lib/slack/events'
import { verifySlackSignature } from '@/lib/slack/signature'
import { ingestThreadReply } from '@/lib/slack/sync'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const secret = slackSigningSecret()

  if (!secret) {
    return NextResponse.json({ error: 'not configured' }, { status: 412 })
  }

  const body = await request.text()

  const verified = verifySlackSignature({
    body,
    nowSeconds: Math.floor(Date.now() / 1000),
    secret,
    signature: request.headers.get('x-slack-signature') ?? '',
    timestamp: request.headers.get('x-slack-request-timestamp') ?? '',
  })

  if (!verified) {
    return NextResponse.json({ error: 'bad signature' }, { status: 401 })
  }

  let payload: unknown = null

  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 })
  }

  const challenge = challengeOf(payload)

  if (challenge) {
    return NextResponse.json({ challenge })
  }

  const message = parseMessageEvent(payload)

  if (message) {
    await ingestThreadReply(message)
  }

  return NextResponse.json({ ok: true })
}
