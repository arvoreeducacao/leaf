import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { ingest } = vi.hoisted(() => ({
  ingest: vi.fn(async () => 'created' as const),
}))

vi.mock('@/lib/slack/sync', () => ({ ingestThreadReply: ingest }))

import { signBody } from '@/lib/slack/signature'

import { POST } from './route'

const SECRET = 'segredo-de-assinatura'

function request(payload: unknown, overrides: Record<string, string> = {}) {
  const body = JSON.stringify(payload)
  const timestamp = String(Math.floor(Date.now() / 1000))

  return new Request('https://leaf.test/api/slack/events', {
    body,
    headers: {
      'content-type': 'application/json',
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature': signBody(SECRET, timestamp, body),
      ...overrides,
    },
    method: 'POST',
  })
}

const reply = {
  event: {
    channel: 'C01',
    text: 'em qualquer livro',
    thread_ts: '1.1',
    ts: '2.2',
    type: 'message',
    user: 'U9',
  },
  type: 'event_callback',
}

describe('POST /api/slack/events', () => {
  beforeEach(() => {
    ingest.mockClear()
    vi.stubEnv('SLACK_SIGNING_SECRET', SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('recusa quando o segredo não está configurado', async () => {
    vi.stubEnv('SLACK_SIGNING_SECRET', '')

    const response = await POST(request(reply))

    expect(response.status).toBe(412)
    expect(ingest).not.toHaveBeenCalled()
  })

  it('recusa assinatura que não confere', async () => {
    const response = await POST(
      request(reply, { 'x-slack-signature': 'v0=naovale' }),
    )

    expect(response.status).toBe(401)
    expect(ingest).not.toHaveBeenCalled()
  })

  it('recusa carimbo velho, mesmo assinado', async () => {
    const body = JSON.stringify(reply)
    const timestamp = String(Math.floor(Date.now() / 1000) - 3600)

    const response = await POST(
      new Request('https://leaf.test/api/slack/events', {
        body,
        headers: {
          'x-slack-request-timestamp': timestamp,
          'x-slack-signature': signBody(SECRET, timestamp, body),
        },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(401)
  })

  it('devolve o desafio da verificação de URL', async () => {
    const response = await POST(
      request({ challenge: 'desafio-123', type: 'url_verification' }),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ challenge: 'desafio-123' })
    expect(ingest).not.toHaveBeenCalled()
  })

  it('entrega a resposta da thread para virar comentário', async () => {
    const response = await POST(request(reply))

    expect(response.status).toBe(200)
    expect(ingest).toHaveBeenCalledWith({
      botId: null,
      channelId: 'C01',
      messageTs: '2.2',
      text: 'em qualquer livro',
      threadTs: '1.1',
      userId: 'U9',
    })
  })

  it('responde 200 para evento que não interessa', async () => {
    const response = await POST(
      request({ event: { type: 'reaction_added' }, type: 'event_callback' }),
    )

    expect(response.status).toBe(200)
    expect(ingest).not.toHaveBeenCalled()
  })

  it('recusa corpo que não é json', async () => {
    const body = 'nao-e-json'
    const timestamp = String(Math.floor(Date.now() / 1000))

    const response = await POST(
      new Request('https://leaf.test/api/slack/events', {
        body,
        headers: {
          'x-slack-request-timestamp': timestamp,
          'x-slack-signature': signBody(SECRET, timestamp, body),
        },
        method: 'POST',
      }),
    )

    expect(response.status).toBe(400)
  })
})
