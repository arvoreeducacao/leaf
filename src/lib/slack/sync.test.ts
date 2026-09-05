import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { db } from '@/db'
import {
  databaseViews,
  documents,
  formWebhooks,
  slackThreads,
  user,
} from '@/db/schema'
import { resetDatabase } from '@/db/testing'
import { listDocumentComments } from '@/lib/comments'

import type { PostMessageInput, ReactionInput, SlackClient } from './api'
import {
  announceSubmission,
  escapeSlackText,
  ingestThreadReply,
  pushCommentToThread,
  reactOnComment,
} from './sync'

const now = new Date('2026-09-05T12:00:00.000Z')

const CHANNEL = 'C01DB3YUUEQ'
const PARENT_TS = '1788525945.625709'
const WEBHOOK = 'https://hooks.slack.com/services/T1/B2/segredo'

type Recorder = Readonly<{
  client: SlackClient
  posted: Array<PostMessageInput>
  reactions: Array<ReactionInput & { op: 'add' | 'remove' }>
}>

function recorder(person: { name: string; image: string | null } | null = null): Recorder {
  const posted: Array<PostMessageInput> = []
  const reactions: Array<ReactionInput & { op: 'add' | 'remove' }> = []

  const client: SlackClient = {
    async addReaction(input) {
      reactions.push({ ...input, op: 'add' })

      return true
    },
    async channelInfo(channelId) {
      return { id: channelId, name: 'feedbacks-e-duvidas-produto' }
    },
    async personInfo(userId) {
      return person === null
        ? null
        : { id: userId, image: person.image, name: person.name }
    },
    async postMessage(input) {
      posted.push(input)

      return {
        channelId: input.channelId,
        messageTs: `ts-${posted.length}`,
      }
    },
    async removeReaction(input) {
      reactions.push({ ...input, op: 'remove' })

      return true
    },
  }

  return { client, posted, reactions }
}

type LinkOptions = Readonly<{
  channelId?: string | null
  url?: string | null
  pullThread?: boolean
  pushComments?: boolean
}>

async function seed(options: LinkOptions = {}) {
  await resetDatabase()

  await db.insert(user).values({
    createdAt: now,
    email: 'slack-owner@arvore.com.br',
    emailVerified: false,
    id: 'slack-owner',
    name: 'Owner',
    updatedAt: now,
  })

  await db.insert(documents).values([
    {
      createdAt: now,
      id: 'slack-base',
      kind: 'database',
      ownerId: 'slack-owner',
      title: 'Feedbacks',
      updatedAt: now,
    },
    {
      createdAt: now,
      id: 'slack-row',
      kind: 'row',
      ownerId: 'slack-owner',
      parentId: 'slack-base',
      title: 'Ícones de acessibilidade se sobrepõem ao texto',
      updatedAt: now,
    },
  ])

  await db.insert(databaseViews).values({
    createdAt: now,
    databaseId: 'slack-base',
    id: 'slack-view',
    name: 'Formulário',
    position: 0,
    type: 'form',
  })

  await db.insert(formWebhooks).values({
    channelId: options.channelId === undefined ? CHANNEL : options.channelId,
    channelName: 'feedbacks-e-duvidas-produto',
    createdAt: now,
    pullThread: options.pullThread ?? true,
    pushComments: options.pushComments ?? true,
    updatedAt: now,
    url: options.url ?? null,
    viewId: 'slack-view',
  })
}

async function linkThread() {
  await db.insert(slackThreads).values({
    channelId: CHANNEL,
    createdAt: now,
    documentId: 'slack-row',
    messageTs: PARENT_TS,
    viewId: 'slack-view',
  })
}

const payload = {
  blocks: [
    {
      text: { text: '*Ícones de acessibilidade*', type: 'mrkdwn' },
      type: 'section',
    },
  ],
  text: '*Ícones de acessibilidade*',
}

const announce = {
  documentId: 'slack-row',
  payload,
  replyHint: 'Respondendo nesta thread você comenta na resposta.',
  viewId: 'slack-view',
}

describe('escapeSlackText', () => {
  it('escapes what would break the message', () => {
    expect(escapeSlackText('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d')
  })
})

describe('announceSubmission', () => {
  it('posts to the channel and keeps the thread of the row', async () => {
    await seed()
    const { client, posted } = recorder()

    expect(await announceSubmission({ ...announce, client })).toBe(true)
    expect(posted).toHaveLength(1)
    expect(posted[0].channelId).toBe(CHANNEL)
    expect(posted[0].text).toBe(payload.text)
    expect(posted[0].blocks?.at(-1)).toEqual({
      elements: [{ text: announce.replyHint, type: 'mrkdwn' }],
      type: 'context',
    })

    const thread = await db.query.slackThreads.findFirst()

    expect(thread).toMatchObject({
      channelId: CHANNEL,
      documentId: 'slack-row',
      messageTs: 'ts-1',
    })
  })

  it('does not promise the thread when pulling is off', async () => {
    await seed({ pullThread: false })
    const { client, posted } = recorder()

    expect(await announceSubmission({ ...announce, client })).toBe(true)
    expect(posted[0].blocks).toEqual(payload.blocks)
  })

  it('falls back to the old webhook when there is no channel', async () => {
    await seed({ channelId: null, url: WEBHOOK })

    const calls: Array<{ url: string; body: string }> = []

    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      calls.push({ body: String(init.body), url: String(url) })

      return new Response('ok')
    })

    expect(await announceSubmission({ ...announce, client: null })).toBe(true)
    expect(calls.map((call) => call.url)).toEqual([WEBHOOK])
    expect(JSON.parse(calls[0].body)).toEqual(payload)
    expect(await db.query.slackThreads.findFirst()).toBeUndefined()

    vi.unstubAllGlobals()
  })

  it('stays silent when the form has nowhere to post', async () => {
    await seed({ channelId: null })
    const { client, posted } = recorder()

    expect(await announceSubmission({ ...announce, client })).toBe(false)
    expect(posted).toHaveLength(0)
  })
})

describe('ingestThreadReply', () => {
  const reply = {
    botId: null,
    channelId: CHANNEL,
    messageTs: '1788526000.000100',
    text: 'Acontece em qualquer livro',
    threadTs: PARENT_TS,
    userId: 'U9',
  }

  it('becomes a comment wearing the face of whoever spoke on Slack', async () => {
    await seed()
    await linkThread()

    const { client } = recorder({
      image: 'https://slack.test/carol.png',
      name: 'Carol Uehara',
    })

    expect(await ingestThreadReply(reply, client)).toBe('created')

    const threads = await listDocumentComments('slack-row')

    expect(threads).toHaveLength(1)
    expect(threads[0]).toMatchObject({
      authorId: null,
      authorImage: 'https://slack.test/carol.png',
      authorName: 'Carol Uehara',
      body: 'Acontece em qualquer livro',
      origin: 'slack',
    })
  })

  it('ignores what the bot itself wrote', async () => {
    await seed()
    await linkThread()

    const { client } = recorder()

    expect(await ingestThreadReply({ ...reply, botId: 'B1' }, client)).toBe(
      'ignored',
    )
    expect(await listDocumentComments('slack-row')).toHaveLength(0)
  })

  it('ignores the message that opened the thread', async () => {
    await seed()
    await linkThread()

    const { client } = recorder()

    expect(
      await ingestThreadReply(
        { ...reply, messageTs: PARENT_TS, threadTs: PARENT_TS },
        client,
      ),
    ).toBe('ignored')
  })

  it('ignores a thread that belongs to no response', async () => {
    await seed()

    const { client } = recorder()

    expect(await ingestThreadReply(reply, client)).toBe('ignored')
  })

  it('ignores replies when pulling the thread is off', async () => {
    await seed({ pullThread: false })
    await linkThread()

    const { client } = recorder()

    expect(await ingestThreadReply(reply, client)).toBe('ignored')
    expect(await listDocumentComments('slack-row')).toHaveLength(0)
  })

  it('the same message twice updates instead of duplicating', async () => {
    await seed()
    await linkThread()

    const { client } = recorder({ image: null, name: 'Carol Uehara' })

    expect(await ingestThreadReply(reply, client)).toBe('created')
    expect(
      await ingestThreadReply({ ...reply, text: 'corrigindo: qualquer livro' }, client),
    ).toBe('updated')

    const threads = await listDocumentComments('slack-row')

    expect(threads).toHaveLength(1)
    expect(threads[0].body).toBe('corrigindo: qualquer livro')
  })

  it('ignores a message with no text', async () => {
    await seed()
    await linkThread()

    const { client } = recorder()

    expect(await ingestThreadReply({ ...reply, text: '   ' }, client)).toBe(
      'ignored',
    )
  })
})

describe('pushCommentToThread', () => {
  const comment = {
    authorImage: 'https://leaf.test/joao.png',
    authorName: 'João Barros',
    body: 'Mapeada pro ciclo de outubro',
    documentId: 'slack-row',
  }

  it('replies in the thread with the name and face of the commenter', async () => {
    await seed()
    await linkThread()

    const { client, posted } = recorder()

    expect(await pushCommentToThread({ ...comment, client })).toBe('ts-1')
    expect(posted[0]).toMatchObject({
      channelId: CHANNEL,
      iconUrl: 'https://leaf.test/joao.png',
      threadTs: PARENT_TS,
      username: 'João Barros',
    })
  })

  it('stays quiet when pushing is off', async () => {
    await seed({ pushComments: false })
    await linkThread()

    const { client, posted } = recorder()

    expect(await pushCommentToThread({ ...comment, client })).toBeNull()
    expect(posted).toHaveLength(0)
  })

  it('stays quiet when the row has no thread', async () => {
    await seed()

    const { client, posted } = recorder()

    expect(await pushCommentToThread({ ...comment, client })).toBeNull()
    expect(posted).toHaveLength(0)
  })
})

describe('reactOnComment', () => {
  it('stamps and unstamps the check on the thread message', async () => {
    await seed()
    await linkThread()

    const { client, reactions } = recorder()

    await reactOnComment({
      client,
      documentId: 'slack-row',
      externalId: '1788526000.000100',
      resolved: true,
    })
    await reactOnComment({
      client,
      documentId: 'slack-row',
      externalId: '1788526000.000100',
      resolved: false,
    })

    expect(reactions).toEqual([
      {
        channelId: CHANNEL,
        messageTs: '1788526000.000100',
        name: 'white_check_mark',
        op: 'add',
      },
      {
        channelId: CHANNEL,
        messageTs: '1788526000.000100',
        name: 'white_check_mark',
        op: 'remove',
      },
    ])
  })
})
