import { and, count, desc, eq, inArray, isNull } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createTranslator } from 'next-intl'

import { db } from '@/db'
import { documents, notifications, user } from '@/db/schema'
import { defaultLocale } from '@/i18n/config'
import { getDocumentAccess } from '@/lib/authz'
import { authIssuer } from '@/lib/mcp-config'
import { addedMentions } from '@/lib/mentions'
import type { SlackClient } from '@/lib/slack/api'
import { isSlackMentionDmEnabled } from '@/lib/slack/config'
import { botClient } from '@/lib/slack/sync'
import { escapeSlackText } from '@/lib/slack/text'
import enMessages from '../../messages/en-US.json'
import ptMessages from '../../messages/pt-BR.json'

const messagesByLocale = { 'en-US': enMessages, 'pt-BR': ptMessages }

export const NOTIFICATION_LIST_LIMIT = 30

export type MentionRecipient = Readonly<{
  id: string
  name: string
  email: string
}>

export type NotifyMentionsInput = Readonly<{
  documentId: string
  actorId: string | null
  previousContent: string | null
  nextContent: string | null
  now?: Date
}>

export type NotificationItem = Readonly<{
  id: string
  kind: 'mention'
  documentId: string
  documentTitle: string
  documentIcon: string | null
  actorId: string | null
  actorName: string | null
  actorImage: string | null
  read: boolean
  createdAt: string
}>

async function canSee(documentId: string, person: MentionRecipient) {
  const access = await getDocumentAccess(documentId, {
    user: { email: person.email, id: person.id },
  })

  return access !== null
}

async function insertOnce(
  input: Readonly<{
    recipientId: string
    actorId: string | null
    documentId: string
    sourceKey: string
    now: Date
  }>,
): Promise<boolean> {
  const result = await db
    .insert(notifications)
    .ignore()
    .values({
      actorId: input.actorId,
      createdAt: input.now,
      documentId: input.documentId,
      id: nanoid(),
      kind: 'mention',
      recipientId: input.recipientId,
      sourceKey: input.sourceKey,
    })

  const affected = (result as unknown as [{ affectedRows?: number }])[0]
    ?.affectedRows

  return affected === 1
}

export async function notifyAddedMentions(
  input: NotifyMentionsInput,
): Promise<Array<MentionRecipient>> {
  const added = addedMentions(input.previousContent, input.nextContent).filter(
    (mention) => mention.userId !== input.actorId,
  )

  if (added.length === 0) {
    return []
  }

  const document = await db.query.documents.findFirst({
    where: eq(documents.id, input.documentId),
  })

  if (!document || document.deletedAt !== null || document.kind === 'template') {
    return []
  }

  const people = await db
    .select({ email: user.email, id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, [...new Set(added.map((item) => item.userId))]))

  const byId = new Map(people.map((person) => [person.id, person]))
  const now = input.now ?? new Date()
  const notified = new Map<string, MentionRecipient>()

  for (const mention of added) {
    const person = byId.get(mention.userId)

    if (!person || !(await canSee(input.documentId, person))) {
      continue
    }

    const created = await insertOnce({
      actorId: input.actorId,
      documentId: input.documentId,
      now,
      recipientId: person.id,
      sourceKey: mention.key,
    })

    if (created) {
      notified.set(person.id, person)
    }
  }

  return [...notified.values()]
}

export type MentionDmInput = Readonly<{
  actorId: string | null
  documentId: string
  recipients: ReadonlyArray<MentionRecipient>
  client?: SlackClient | null
}>

export function mentionDmText(
  actorName: string | null,
  documentTitle: string,
  url: string,
): string {
  const t = createTranslator({
    locale: defaultLocale,
    messages: messagesByLocale[defaultLocale],
    namespace: 'notifications',
  })
  const title = escapeSlackText(documentTitle).replace(/\|/g, '¦')
  const actor = escapeSlackText(actorName ?? t('someone'))

  return t('slackMention', { actor, link: `<${url}|${title}>` })
}

export async function sendMentionDms(input: MentionDmInput): Promise<number> {
  const client = input.client === undefined ? botClient() : input.client

  if (
    !client ||
    input.recipients.length === 0 ||
    !isSlackMentionDmEnabled()
  ) {
    return 0
  }

  const document = await db.query.documents.findFirst({
    where: eq(documents.id, input.documentId),
  })

  if (!document) {
    return 0
  }

  const actor = input.actorId
    ? await db.query.user.findFirst({ where: eq(user.id, input.actorId) })
    : undefined
  const text = mentionDmText(
    actor?.name ?? null,
    document.title,
    `${authIssuer()}/doc/${input.documentId}`,
  )
  let sent = 0

  for (const recipient of input.recipients) {
    const slackUserId = await client.userIdByEmail(recipient.email)

    if (!slackUserId) {
      continue
    }

    const posted = await client.postMessage({
      channelId: slackUserId,
      text,
    })

    if (posted) {
      sent += 1
    }
  }

  return sent
}

export async function countUnreadNotifications(
  recipientId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        isNull(notifications.readAt),
      ),
    )

  return row?.total ?? 0
}

export async function listNotifications(
  viewer: Readonly<{ id: string; email: string }>,
  limit = NOTIFICATION_LIST_LIMIT,
): Promise<Array<NotificationItem>> {
  const rows = await db
    .select({
      actorId: notifications.actorId,
      actorImage: user.image,
      actorName: user.name,
      createdAt: notifications.createdAt,
      deletedAt: documents.deletedAt,
      documentIcon: documents.icon,
      documentId: notifications.documentId,
      documentTitle: documents.title,
      id: notifications.id,
      kind: notifications.kind,
      readAt: notifications.readAt,
    })
    .from(notifications)
    .innerJoin(documents, eq(documents.id, notifications.documentId))
    .leftJoin(user, eq(user.id, notifications.actorId))
    .where(eq(notifications.recipientId, viewer.id))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)

  const items: Array<NotificationItem> = []

  for (const row of rows) {
    if (row.deletedAt !== null) {
      continue
    }

    const access = await getDocumentAccess(row.documentId, {
      user: { email: viewer.email, id: viewer.id },
    })

    if (access === null) {
      continue
    }

    items.push({
      actorId: row.actorId,
      actorImage: row.actorImage ?? null,
      actorName: row.actorName ?? null,
      createdAt: row.createdAt.toISOString(),
      documentIcon: row.documentIcon,
      documentId: row.documentId,
      documentTitle: row.documentTitle,
      id: row.id,
      kind: row.kind,
      read: row.readAt !== null,
    })
  }

  return items
}

export async function markNotificationsRead(
  recipientId: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: now })
    .where(
      and(
        eq(notifications.recipientId, recipientId),
        isNull(notifications.readAt),
      ),
    )
}
