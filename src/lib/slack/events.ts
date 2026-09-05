import type { ThreadMessage } from './sync'

const RELAYED_SUBTYPES = new Set([undefined, 'message_changed'])

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function challengeOf(payload: unknown): string | null {
  const body = asRecord(payload)

  return body?.type === 'url_verification' ? asString(body.challenge) : null
}

export function parseMessageEvent(payload: unknown): ThreadMessage | null {
  const body = asRecord(payload)

  if (body?.type !== 'event_callback') {
    return null
  }

  const event = asRecord(body.event)

  if (event?.type !== 'message') {
    return null
  }

  const subtype = typeof event.subtype === 'string' ? event.subtype : undefined

  if (!RELAYED_SUBTYPES.has(subtype)) {
    return null
  }

  const source = subtype === 'message_changed' ? asRecord(event.message) : event

  if (!source) {
    return null
  }

  const channelId = asString(event.channel)
  const messageTs = asString(source.ts)
  const threadTs = asString(source.thread_ts)

  if (!channelId || !messageTs) {
    return null
  }

  return {
    botId: asString(source.bot_id),
    channelId,
    messageTs,
    text: typeof source.text === 'string' ? source.text : '',
    threadTs,
    userId: asString(source.user),
  }
}
