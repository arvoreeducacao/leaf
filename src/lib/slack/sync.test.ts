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

const announce = {
  documentId: 'slack-row',
  openLabel: 'Abrir a resposta no Leaf',
  replyHint: 'Respondendo nesta thread você comenta na resposta.',
  text: '*Ícones de acessibilidade*',
  viewId: 'slack-view',
}

describe('escapeSlackText', () => {
  it('escapa o que quebraria a mensagem', () => {
    expect(escapeSlackText('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d')
  })
})

describe('announceSubmission', () => {
  it('posta no canal e guarda a thread da linha', async () => {
    await seed()
    const { client, posted } = recorder()

    expect(await announceSubmission({ ...announce, client })).toBe(true)
    expect(posted).toHaveLength(1)
    expect(posted[0].channelId).toBe(CHANNEL)
    expect(posted[0].text).toContain('/doc/slack-row|Abrir a resposta no Leaf')
    expect(posted[0].text).toContain('Respondendo nesta thread')

    const thread = await db.query.slackThreads.findFirst()

    expect(thread).toMatchObject({
      channelId: CHANNEL,
      documentId: 'slack-row',
      messageTs: 'ts-1',
    })
  })

  it('não promete a thread quando o retorno está desligado', async () => {
    await seed({ pullThread: false })
    const { client, posted } = recorder()

    expect(await announceSubmission({ ...announce, client })).toBe(true)
    expect(posted[0].text).not.toContain('Respondendo nesta thread')
  })

  it('cai no webhook antigo quando não há canal', async () => {
    await seed({ channelId: null, url: WEBHOOK })

    const calls: Array<string> = []

    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(String(url))

      return new Response('ok')
    })

    expect(await announceSubmission({ ...announce, client: null })).toBe(true)
    expect(calls).toEqual([WEBHOOK])
    expect(await db.query.slackThreads.findFirst()).toBeUndefined()

    vi.unstubAllGlobals()
  })

  it('não anuncia quando o formulário não tem destino', async () => {
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

  it('vira comentário com o rosto de quem falou no Slack', async () => {
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

  it('ignora o que o próprio bot escreveu', async () => {
    await seed()
    await linkThread()

    const { client } = recorder()

    expect(await ingestThreadReply({ ...reply, botId: 'B1' }, client)).toBe(
      'ignored',
    )
    expect(await listDocumentComments('slack-row')).toHaveLength(0)
  })

  it('ignora a mensagem que abriu a thread', async () => {
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

  it('ignora thread que não é de nenhuma resposta', async () => {
    await seed()

    const { client } = recorder()

    expect(await ingestThreadReply(reply, client)).toBe('ignored')
  })

  it('ignora quando o retorno da thread está desligado', async () => {
    await seed({ pullThread: false })
    await linkThread()

    const { client } = recorder()

    expect(await ingestThreadReply(reply, client)).toBe('ignored')
    expect(await listDocumentComments('slack-row')).toHaveLength(0)
  })

  it('a mesma mensagem duas vezes atualiza em vez de duplicar', async () => {
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

  it('ignora mensagem sem texto', async () => {
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

  it('responde na thread com o nome e a foto de quem comentou', async () => {
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

  it('fica quieto quando o envio está desligado', async () => {
    await seed({ pushComments: false })
    await linkThread()

    const { client, posted } = recorder()

    expect(await pushCommentToThread({ ...comment, client })).toBeNull()
    expect(posted).toHaveLength(0)
  })

  it('fica quieto quando a linha não tem thread', async () => {
    await seed()

    const { client, posted } = recorder()

    expect(await pushCommentToThread({ ...comment, client })).toBeNull()
    expect(posted).toHaveLength(0)
  })
})

describe('reactOnComment', () => {
  it('carimba o visto e tira o visto na mensagem da thread', async () => {
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
