import { describe, expect, it } from 'vitest'

import { createSlackClient, encodeArguments } from './api'

type Call = Readonly<{ url: string; contentType: string; body: string }>

function recordingFetch(payload: Record<string, unknown>) {
  const calls: Array<Call> = []

  const fetcher = (async (url: string, init: RequestInit) => {
    const headers = init.headers as Record<string, string>

    calls.push({
      body: String(init.body),
      contentType: headers['content-type'],
      url: String(url),
    })

    return new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof globalThis.fetch

  return { calls, fetcher }
}

describe('encodeArguments', () => {
  it('escreve o corpo no formato que o Slack aceita', () => {
    const body = encodeArguments({
      channel: 'C01',
      text: 'olá & tchau',
      unfurl_links: false,
    })

    expect(body).toBeInstanceOf(URLSearchParams)
    expect(body.get('channel')).toBe('C01')
    expect(body.get('text')).toBe('olá & tchau')
    expect(body.get('unfurl_links')).toBe('false')
  })

  it('deixa de fora o que não foi informado', () => {
    const body = encodeArguments({ channel: 'C01', thread_ts: undefined })

    expect(body.has('thread_ts')).toBe(false)
  })
})

describe('createSlackClient', () => {
  it('pergunta pelo canal em form-encoded, não em json', async () => {
    const { calls, fetcher } = recordingFetch({
      channel: { id: 'C01', name: 'feedbacks' },
      ok: true,
    })

    const channel = await createSlackClient('xoxb-teste', {
      fetch: fetcher,
    }).channelInfo('C01')

    expect(channel).toEqual({ id: 'C01', name: 'feedbacks' })
    expect(calls[0].contentType).toBe(
      'application/x-www-form-urlencoded; charset=utf-8',
    )
    expect(calls[0].body).toBe('channel=C01')
  })

  it('manda a mensagem com autor e thread', async () => {
    const { calls, fetcher } = recordingFetch({
      channel: 'C01',
      ok: true,
      ts: '1.2',
    })

    const posted = await createSlackClient('xoxb-teste', {
      fetch: fetcher,
    }).postMessage({
      channelId: 'C01',
      iconUrl: 'https://leaf.test/rosto.png',
      text: 'oi',
      threadTs: '1.1',
      username: 'João Barros',
    })

    expect(posted).toEqual({ channelId: 'C01', messageTs: '1.2' })

    const body = new URLSearchParams(calls[0].body)

    expect(calls[0].url).toBe('https://slack.com/api/chat.postMessage')
    expect(body.get('thread_ts')).toBe('1.1')
    expect(body.get('username')).toBe('João Barros')
    expect(body.get('icon_url')).toBe('https://leaf.test/rosto.png')
  })

  it('devolve nulo quando o Slack recusa', async () => {
    const { fetcher } = recordingFetch({ error: 'invalid_arguments', ok: false })

    const channel = await createSlackClient('xoxb-teste', {
      fetch: fetcher,
    }).channelInfo('C01')

    expect(channel).toBeNull()
  })

  it('lê o nome e o rosto de quem falou', async () => {
    const { fetcher } = recordingFetch({
      ok: true,
      user: {
        id: 'U9',
        profile: {
          display_name: 'Carol Uehara',
          image_72: 'https://slack.test/carol.png',
        },
      },
    })

    const person = await createSlackClient('xoxb-teste', {
      fetch: fetcher,
    }).personInfo('U9')

    expect(person).toEqual({
      id: 'U9',
      image: 'https://slack.test/carol.png',
      name: 'Carol Uehara',
    })
  })
})
