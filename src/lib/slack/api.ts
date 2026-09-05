import { SLACK_TIMEOUT_MS } from './config'

const API_BASE = 'https://slack.com/api'

export type SlackPostedMessage = Readonly<{
  channelId: string
  messageTs: string
}>

export type SlackChannel = Readonly<{ id: string; name: string }>

export type SlackPerson = Readonly<{
  id: string
  name: string
  image: string | null
}>

export type PostMessageInput = Readonly<{
  channelId: string
  text: string
  blocks?: ReadonlyArray<unknown>
  threadTs?: string
  username?: string
  iconUrl?: string | null
}>

export type ReactionInput = Readonly<{
  channelId: string
  messageTs: string
  name: string
}>

export type SlackClient = Readonly<{
  postMessage(input: PostMessageInput): Promise<SlackPostedMessage | null>
  addReaction(input: ReactionInput): Promise<boolean>
  removeReaction(input: ReactionInput): Promise<boolean>
  channelInfo(channelId: string): Promise<SlackChannel | null>
  personInfo(userId: string): Promise<SlackPerson | null>
}>

export type SlackClientOptions = Readonly<{
  fetch?: typeof globalThis.fetch
  signal?: AbortSignal
}>

type SlackResponse = Record<string, unknown> & { ok?: unknown }

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function encodeValue(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  return JSON.stringify(value)
}

export function encodeArguments(
  payload: Record<string, unknown>,
): URLSearchParams {
  const body = new URLSearchParams()

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) {
      continue
    }

    body.set(key, encodeValue(value))
  }

  return body
}

export function createSlackClient(
  token: string,
  options: SlackClientOptions = {},
): SlackClient {
  const call = options.fetch ?? globalThis.fetch

  async function post(
    method: string,
    payload: Record<string, unknown>,
  ): Promise<SlackResponse | null> {
    try {
      const response = await call(`${API_BASE}/${method}`, {
        body: encodeArguments(payload),
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
        },
        method: 'POST',
        signal: options.signal ?? AbortSignal.timeout(SLACK_TIMEOUT_MS),
      })

      const body: unknown = await response.json()
      const parsed = asRecord(body)

      return parsed?.ok === true ? (parsed as SlackResponse) : null
    } catch {
      return null
    }
  }

  return {
    async postMessage(input) {
      const body = await post('chat.postMessage', {
        channel: input.channelId,
        text: input.text,
        unfurl_links: false,
        unfurl_media: false,
        ...(input.blocks === undefined ? {} : { blocks: input.blocks }),
        ...(input.threadTs === undefined ? {} : { thread_ts: input.threadTs }),
        ...(input.username === undefined ? {} : { username: input.username }),
        ...(input.iconUrl ? { icon_url: input.iconUrl } : {}),
      })

      const channelId = asString(body?.channel)
      const messageTs = asString(body?.ts)

      return channelId && messageTs ? { channelId, messageTs } : null
    },

    async addReaction(input) {
      const body = await post('reactions.add', {
        channel: input.channelId,
        name: input.name,
        timestamp: input.messageTs,
      })

      return body !== null
    },

    async removeReaction(input) {
      const body = await post('reactions.remove', {
        channel: input.channelId,
        name: input.name,
        timestamp: input.messageTs,
      })

      return body !== null
    },

    async channelInfo(channelId) {
      const body = await post('conversations.info', { channel: channelId })
      const channel = asRecord(body?.channel)
      const id = asString(channel?.id)
      const name = asString(channel?.name)

      return id && name ? { id, name } : null
    },

    async personInfo(userId) {
      const body = await post('users.info', { user: userId })
      const person = asRecord(body?.user)
      const profile = asRecord(person?.profile)
      const id = asString(person?.id)

      if (!id) {
        return null
      }

      const name =
        asString(profile?.display_name) ??
        asString(profile?.real_name) ??
        asString(person?.real_name) ??
        asString(person?.name) ??
        id

      return {
        id,
        image:
          asString(profile?.image_72) ?? asString(profile?.image_192) ?? null,
        name,
      }
    },
  }
}
