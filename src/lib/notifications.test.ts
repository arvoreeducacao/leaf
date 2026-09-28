import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { db } from '@/db'
import {
  documentShares,
  documents,
  notifications,
  organizationMembers,
  organizations,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { persistDocumentContent } from '@/lib/document-content'
import {
  countUnreadNotifications,
  listNotifications,
  markNotificationsRead,
  mentionDmText,
  notifyAddedMentions,
  sendMentionDms,
} from '@/lib/notifications'
import type { PostMessageInput, SlackClient } from '@/lib/slack/api'

const ana = { id: 'user-ana', email: 'ana@example.com', name: 'Ana Lima' }
const bruno = { id: 'user-bruno', email: 'bruno@example.com', name: 'Bruno' }
const carla = { id: 'user-carla', email: 'carla@example.com', name: 'Carla' }
const outsider = { id: 'user-out', email: 'out@example.com', name: 'Out' }

const orgId = 'org-acme'
const docId = 'doc-mentions'

function mention(userId: string, mentionId: string, name = userId) {
  return { props: { mentionId, name, userId }, type: 'mention' }
}

function contentWith(...inline: Array<unknown>) {
  return JSON.stringify([
    {
      children: [],
      content: [{ styles: {}, text: 'Hi ', type: 'text' }, ...inline],
      id: 'block-1',
      props: {},
      type: 'paragraph',
    },
  ])
}

async function notificationRows() {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.documentId, docId))
}

function recordingSlack(ids: Record<string, string>) {
  const posted: Array<PostMessageInput> = []
  const client: SlackClient = {
    async addReaction() {
      return true
    },
    async channelInfo() {
      return null
    },
    async personInfo() {
      return null
    },
    async postMessage(input) {
      posted.push(input)

      return { channelId: input.channelId, messageTs: '1.1' }
    },
    async removeReaction() {
      return true
    },
    async userIdByEmail(email) {
      return ids[email] ?? null
    },
  }

  return { client, posted }
}

beforeEach(async () => {
  await resetDatabase()

  const now = new Date()

  await db.insert(user).values(
    [ana, bruno, carla, outsider].map((person) => ({
      ...person,
      createdAt: now,
      emailVerified: false,
      updatedAt: now,
    })),
  )
  await db.insert(organizations).values({ id: orgId, name: 'Acme' })
  await db.insert(organizationMembers).values(
    [ana, bruno, carla].map((person) => ({
      id: `member-${person.id}`,
      orgId,
      userId: person.id,
    })),
  )
  await db.insert(documents).values({
    createdAt: now,
    id: docId,
    orgAccess: 'editor',
    orgId,
    ownerId: ana.id,
    title: 'Planning',
    updatedAt: now,
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('notifyAddedMentions', () => {
  it('notifies each person newly mentioned by someone else', async () => {
    const recipients = await notifyAddedMentions({
      actorId: ana.id,
      documentId: docId,
      nextContent: contentWith(mention(bruno.id, 'm1'), mention(carla.id, 'm2')),
      previousContent: null,
    })

    expect(recipients.map((person) => person.id).sort()).toEqual([
      bruno.id,
      carla.id,
    ])

    const rows = await notificationRows()

    expect(rows).toHaveLength(2)
    expect(rows.every((row) => row.actorId === ana.id)).toBe(true)
    expect(rows.every((row) => row.readAt === null)).toBe(true)
  })

  it('never notifies the author for mentioning themselves', async () => {
    const recipients = await notifyAddedMentions({
      actorId: ana.id,
      documentId: docId,
      nextContent: contentWith(mention(ana.id, 'm1')),
      previousContent: null,
    })

    expect(recipients).toEqual([])
    expect(await notificationRows()).toHaveLength(0)
  })

  it('ignores mentions that were already in the previous content', async () => {
    const before = contentWith(mention(bruno.id, 'm1'))

    const recipients = await notifyAddedMentions({
      actorId: ana.id,
      documentId: docId,
      nextContent: contentWith(mention(bruno.id, 'm1'), ' more text'),
      previousContent: before,
    })

    expect(recipients).toEqual([])
  })

  it('does not notify twice when the same mention comes back after an undo', async () => {
    const withMention = contentWith(mention(bruno.id, 'm1'))
    const without = contentWith()

    await notifyAddedMentions({
      actorId: ana.id,
      documentId: docId,
      nextContent: withMention,
      previousContent: without,
    })

    const again = await notifyAddedMentions({
      actorId: ana.id,
      documentId: docId,
      nextContent: withMention,
      previousContent: without,
    })

    expect(again).toEqual([])
    expect(await notificationRows()).toHaveLength(1)
  })

  it('notifies again for a new mention of the same person', async () => {
    await notifyAddedMentions({
      actorId: ana.id,
      documentId: docId,
      nextContent: contentWith(mention(bruno.id, 'm1')),
      previousContent: null,
    })

    const second = await notifyAddedMentions({
      actorId: ana.id,
      documentId: docId,
      nextContent: contentWith(mention(bruno.id, 'm1'), mention(bruno.id, 'm2')),
      previousContent: contentWith(mention(bruno.id, 'm1')),
    })

    expect(second.map((person) => person.id)).toEqual([bruno.id])
    expect(await notificationRows()).toHaveLength(2)
  })

  it('never notifies someone who cannot open the page', async () => {
    const recipients = await notifyAddedMentions({
      actorId: ana.id,
      documentId: docId,
      nextContent: contentWith(mention(outsider.id, 'm1')),
      previousContent: null,
    })

    expect(recipients).toEqual([])
    expect(await notificationRows()).toHaveLength(0)
  })

  it('notifies someone outside the organization who has the page shared', async () => {
    await db.insert(documentShares).values({
      documentId: docId,
      granteeEmail: outsider.email,
      id: 'share-out',
      role: 'viewer',
    })

    const recipients = await notifyAddedMentions({
      actorId: ana.id,
      documentId: docId,
      nextContent: contentWith(mention(outsider.id, 'm1')),
      previousContent: null,
    })

    expect(recipients.map((person) => person.id)).toEqual([outsider.id])
  })

  it('skips people who do not exist', async () => {
    const recipients = await notifyAddedMentions({
      actorId: ana.id,
      documentId: docId,
      nextContent: contentWith(mention('user-ghost', 'm1')),
      previousContent: null,
    })

    expect(recipients).toEqual([])
  })

  it('stays quiet on templates and pages in the trash', async () => {
    await db
      .update(documents)
      .set({ kind: 'template' })
      .where(eq(documents.id, docId))

    expect(
      await notifyAddedMentions({
        actorId: ana.id,
        documentId: docId,
        nextContent: contentWith(mention(bruno.id, 'm1')),
        previousContent: null,
      }),
    ).toEqual([])

    await db
      .update(documents)
      .set({ deletedAt: new Date(), kind: 'page' })
      .where(eq(documents.id, docId))

    expect(
      await notifyAddedMentions({
        actorId: ana.id,
        documentId: docId,
        nextContent: contentWith(mention(bruno.id, 'm1')),
        previousContent: null,
      }),
    ).toEqual([])
  })
})

describe('persistDocumentContent', () => {
  it('notifies once across repeated saves of the same content', async () => {
    const content = contentWith(mention(bruno.id, 'm1', 'Bruno'))

    await persistDocumentContent(docId, content, ana.id)
    await persistDocumentContent(
      docId,
      contentWith(mention(bruno.id, 'm1', 'Bruno'), ' edited'),
      ana.id,
    )

    const rows = await notificationRows()

    expect(rows).toHaveLength(1)
    expect(rows[0].recipientId).toBe(bruno.id)
  })

  it('keeps saving when a mention points at nobody', async () => {
    const written = await persistDocumentContent(
      docId,
      contentWith(mention('user-ghost', 'm1')),
      ana.id,
    )

    expect(written).toBe(true)
  })
})

describe('the notification inbox', () => {
  it('lists, counts and marks as read what the person received', async () => {
    await notifyAddedMentions({
      actorId: ana.id,
      documentId: docId,
      nextContent: contentWith(mention(bruno.id, 'm1')),
      previousContent: null,
    })

    expect(await countUnreadNotifications(bruno.id)).toBe(1)

    const items = await listNotifications(bruno)

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      actorId: ana.id,
      actorName: ana.name,
      documentId: docId,
      documentTitle: 'Planning',
      kind: 'mention',
      read: false,
    })

    await markNotificationsRead(bruno.id)

    expect(await countUnreadNotifications(bruno.id)).toBe(0)
    expect((await listNotifications(bruno))[0].read).toBe(true)
  })

  it('hides notifications of pages the person can no longer open', async () => {
    await notifyAddedMentions({
      actorId: ana.id,
      documentId: docId,
      nextContent: contentWith(mention(bruno.id, 'm1')),
      previousContent: null,
    })

    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.userId, bruno.id))

    expect(await listNotifications(bruno)).toEqual([])
  })

  it('hides notifications of pages in the trash', async () => {
    await notifyAddedMentions({
      actorId: ana.id,
      documentId: docId,
      nextContent: contentWith(mention(bruno.id, 'm1')),
      previousContent: null,
    })

    await db
      .update(documents)
      .set({ deletedAt: new Date() })
      .where(eq(documents.id, docId))

    expect(await listNotifications(bruno)).toEqual([])
  })
})

describe('sendMentionDms', () => {
  it('sends nothing unless the Slack flag is on', async () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test')
    vi.stubEnv('LEAF_SLACK_MENTION_DMS', '')

    const { client, posted } = recordingSlack({ [bruno.email]: 'U1' })

    expect(
      await sendMentionDms({
        actorId: ana.id,
        client,
        documentId: docId,
        recipients: [bruno],
      }),
    ).toBe(0)
    expect(posted).toEqual([])
  })

  it('sends a direct message with the page link to whoever Slack knows', async () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-test')
    vi.stubEnv('LEAF_SLACK_MENTION_DMS', 'true')
    vi.stubEnv('BETTER_AUTH_URL', 'https://wiki.example.com')

    const { client, posted } = recordingSlack({ [bruno.email]: 'U1' })

    const sent = await sendMentionDms({
      actorId: ana.id,
      client,
      documentId: docId,
      recipients: [bruno, carla],
    })

    expect(sent).toBe(1)
    expect(posted).toHaveLength(1)
    expect(posted[0].channelId).toBe('U1')
    expect(posted[0].text).toContain('Ana Lima')
    expect(posted[0].text).toContain(
      `<https://wiki.example.com/doc/${docId}|Planning>`,
    )
  })
})

describe('mentionDmText', () => {
  it('escapes what Slack would read as markup', () => {
    const text = mentionDmText('<Ana>', 'A | B & C', 'https://x.test/doc/1')

    expect(text).toContain('&lt;Ana&gt;')
    expect(text).toContain('<https://x.test/doc/1|A ¦ B &amp; C>')
  })

  it('names someone when the author is unknown', () => {
    expect(mentionDmText(null, 'Doc', 'https://x.test')).not.toContain('null')
  })
})
