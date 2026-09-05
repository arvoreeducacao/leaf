import {
  createComment,
  getCommentByExternalId,
  updateCommentByExternalId,
} from '@/lib/comments'
import { isSlackWebhook } from '@/lib/database/form-message'
import { getFormSlack } from '@/lib/form-webhooks'
import { authIssuer } from '@/lib/mcp-config'

import { type SlackClient, createSlackClient } from './api'
import { escapeSlackText } from './text'
import { SLACK_TIMEOUT_MS, slackBotToken } from './config'
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

export function rowUrl(documentId: string): string {
  return `${authIssuer()}/doc/${documentId}`
}

export function botClient(): SlackClient | null {
  const token = slackBotToken()

  return token === null ? null : createSlackClient(token)
}

async function postToWebhook(url: string, text: string): Promise<void> {
  try {
    await fetch(url, {
      body: JSON.stringify({ text }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    })
  } catch {
    return
  }
}

export type AnnounceInput = Readonly<{
  viewId: string
  documentId: string
  text: string
  openLabel: string
  replyHint: string
  client?: SlackClient | null
}>

export async function announceSubmission(
  input: AnnounceInput,
): Promise<boolean> {
  const link = await getFormSlack(input.viewId)

  if (!link) {
    return false
  }

  const client = input.client === undefined ? botClient() : input.client

  if (link.channelId && client) {
    const body = [
      input.text,
      `<${rowUrl(input.documentId)}|${input.openLabel}>`,
      link.pullThread ? `_${input.replyHint}_` : null,
    ]
      .filter((line): line is string => line !== null)
      .join('\n\n')

    const posted = await client.postMessage({
      channelId: link.channelId,
      text: body,
    })

    if (!posted) {
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
    await postToWebhook(link.url, input.text)

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

  return created === null ? 'ignored' : 'created'
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
