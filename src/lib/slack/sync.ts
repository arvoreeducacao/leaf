import {
  createComment,
  getCommentByExternalId,
  updateCommentByExternalId,
} from '@/lib/comments'
import { isSlackWebhook } from '@/lib/database/form-message'
import { getFormSlack } from '@/lib/form-webhooks'
import { signalOpenTabs } from '@/lib/realtime-signals'

import { type SlackClient, createSlackClient } from './api'
import { SLACK_TIMEOUT_MS, slackBotToken } from './config'
import { escapeSlackText } from './text'
import { getThreadOfDocument, getThreadOfMessage, saveThread } from './threads'

export { escapeSlackText }

export const RESOLVED_REACTION = 'white_check_mark'

export type ThreadMessage = Readonly<{
  channelId: string
  threadTs: string | null
  messageTs: string
  text: string
  userId: string | null
  botId: string | null
}>

export type IngestOutcome = 'created' | 'updated' | 'ignored'

export type SlackAnnouncePayload = Readonly<{
  text: string
  blocks: ReadonlyArray<unknown>
}>

export function botClient(): SlackClient | null {
  const token = slackBotToken()

  return token === null ? null : createSlackClient(token)
}

async function postToWebhook(
  url: string,
  payload: SlackAnnouncePayload,
): Promise<boolean> {
  try {
    const response = await fetch(url, {
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    })

    return response.ok
  } catch {
    return false
  }
}

function isImageBlock(block: unknown): boolean {
  return (
    typeof block === 'object' &&
    block !== null &&
    (block as { type?: unknown }).type === 'image'
  )
}

function withoutImages(
  blocks: ReadonlyArray<unknown>,
): ReadonlyArray<unknown> | null {
  const kept = blocks.filter((block) => !isImageBlock(block))

  return kept.length === blocks.length ? null : kept
}

async function withImageFallback<T>(
  blocks: ReadonlyArray<unknown>,
  send: (attempt: ReadonlyArray<unknown>) => Promise<T | null>,
): Promise<T | null> {
  const first = await send(blocks)

  if (first !== null) {
    return first
  }

  const textOnly = withoutImages(blocks)

  return textOnly === null ? null : send(textOnly)
}

export type AnnounceInput = Readonly<{
  viewId: string
  documentId: string
  payload: SlackAnnouncePayload
  replyHint: string
  client?: SlackClient | null
}>

function withReplyHint(
  payload: SlackAnnouncePayload,
  replyHint: string,
): ReadonlyArray<unknown> {
  return [
    ...payload.blocks,
    { elements: [{ text: replyHint, type: 'mrkdwn' }], type: 'context' },
  ]
}

export async function announceSubmission(
  input: AnnounceInput,
): Promise<boolean> {
  const link = await getFormSlack(input.viewId)

  if (!link) {
    return false
  }

  const client = input.client === undefined ? botClient() : input.client

  if (link.channelId && client) {
    const channelId = link.channelId
    const posted = await withImageFallback(
      link.pullThread
        ? withReplyHint(input.payload, input.replyHint)
        : input.payload.blocks,
      (blocks) =>
        client.postMessage({ blocks, channelId, text: input.payload.text }),
    )

    if (!posted) {
      console.error('Form submission not announced on Slack', input.documentId)

      return false
    }

    await saveThread({
      channelId: posted.channelId,
      documentId: input.documentId,
      messageTs: posted.messageTs,
      viewId: input.viewId,
    })

    return true
  }

  if (link.url && isSlackWebhook(link.url)) {
    const url = link.url
    const delivered = await withImageFallback(input.payload.blocks, (blocks) =>
      postToWebhook(url, { ...input.payload, blocks }).then((ok) =>
        ok ? true : null,
      ),
    )

    if (!delivered) {
      console.error('Form submission not announced on Slack', input.documentId)

      return false
    }

    return true
  }

  return false
}

export async function ingestThreadReply(
  message: ThreadMessage,
  client: SlackClient | null = botClient(),
): Promise<IngestOutcome> {
  if (message.botId !== null || message.threadTs === null) {
    return 'ignored'
  }

  if (message.threadTs === message.messageTs) {
    return 'ignored'
  }

  const body = message.text.trim()

  if (body.length === 0) {
    return 'ignored'
  }

  const thread = await getThreadOfMessage(message.channelId, message.threadTs)

  if (!thread) {
    return 'ignored'
  }

  if (thread.viewId) {
    const link = await getFormSlack(thread.viewId)

    if (link && !link.pullThread) {
      return 'ignored'
    }
  }

  const existing = await getCommentByExternalId(
    thread.documentId,
    message.messageTs,
  )

  if (existing) {
    await updateCommentByExternalId(
      thread.documentId,
      message.messageTs,
      body,
    )
    await signalOpenTabs([thread.documentId], 'comments')

    return 'updated'
  }

  const person =
    message.userId && client ? await client.personInfo(message.userId) : null

  const created = await createComment({
    authorId: null,
    body,
    documentId: thread.documentId,
    externalAuthor: {
      id: person?.id ?? message.userId ?? 'slack',
      image: person?.image ?? null,
      name: person?.name ?? message.userId ?? 'Slack',
    },
    externalId: message.messageTs,
    origin: 'slack',
  })

  if (created === null) {
    return 'ignored'
  }

  await signalOpenTabs([thread.documentId], 'comments')

  return 'created'
}

export type PushCommentInput = Readonly<{
  documentId: string
  body: string
  authorName: string | null
  authorImage: string | null
  client?: SlackClient | null
}>

export async function pushCommentToThread(
  input: PushCommentInput,
): Promise<string | null> {
  const thread = await getThreadOfDocument(input.documentId)

  if (!thread) {
    return null
  }

  if (thread.viewId) {
    const link = await getFormSlack(thread.viewId)

    if (link && !link.pushComments) {
      return null
    }
  }

  const client = input.client === undefined ? botClient() : input.client

  if (!client) {
    return null
  }

  const posted = await client.postMessage({
    channelId: thread.channelId,
    iconUrl: input.authorImage,
    text: escapeSlackText(input.body),
    threadTs: thread.messageTs,
    ...(input.authorName === null ? {} : { username: input.authorName }),
  })

  return posted?.messageTs ?? null
}

export type ReactionOnCommentInput = Readonly<{
  documentId: string
  externalId: string
  resolved: boolean
  client?: SlackClient | null
}>

export async function reactOnComment(
  input: ReactionOnCommentInput,
): Promise<boolean> {
  const thread = await getThreadOfDocument(input.documentId)

  if (!thread) {
    return false
  }

  const client = input.client === undefined ? botClient() : input.client

  if (!client) {
    return false
  }

  const reaction = {
    channelId: thread.channelId,
    messageTs: input.externalId,
    name: RESOLVED_REACTION,
  }

  return input.resolved
    ? client.addReaction(reaction)
    : client.removeReaction(reaction)
}
