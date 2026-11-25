import { describe, expect, it, vi } from 'vitest'

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

function sequenceFetch(payloads: ReadonlyArray<Record<string, unknown>>) {
  const bodies: Array<URLSearchParams> = []

  const fetcher = (async (_url: string, init: RequestInit) => {
    const payload = payloads[Math.min(bodies.length, payloads.length - 1)]

    bodies.push(new URLSearchParams(String(init.body)))

    return new Response(JSON.stringify(payload), {
      headers: { 'content-type': 'application/json' },
    })
  }) as unknown as typeof globalThis.fetch

  return { bodies, fetcher }
}

const blocksWithImage = [
  { text: { text: '*Prints*', type: 'mrkdwn' }, type: 'section' },
  {
    alt_text: 'print.png',
    image_url: 'https://leaf.test/api/uploads/u/print.png',
    type: 'image',
  },
]

function blockTypes(body: URLSearchParams): Array<string> {
  return (JSON.parse(body.get('blocks') ?? '[]') as Array<{ type: string }>)
    .map((block) => block.type)
}

describe('encodeArguments', () => {
  it('writes the body in the shape Slack accepts', () => {
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

  it('serializes blocks as json, which is what Slack parses', () => {
    const blocks = [{ text: { text: '*oi*', type: 'mrkdwn' }, type: 'section' }]
    const body = encodeArguments({ blocks, channel: 'C01' })

    expect(body.get('blocks')).toBe(JSON.stringify(blocks))
    expect(body.get('blocks')).not.toContain('[object Object]')
  })

  it('leaves out what was not given', () => {
    const body = encodeArguments({ channel: 'C01', thread_ts: undefined })

    expect(body.has('thread_ts')).toBe(false)
  })
})

describe('createSlackClient', () => {
  it('asks about the channel form-encoded, not as json', async () => {
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

  it('posts the message with an author and a thread', async () => {
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

  it('tells the log why Slack refused the message', async () => {
    const { fetcher } = recordingFetch({
      error: 'invalid_blocks',
      ok: false,
      response_metadata: {
        messages: ['[ERROR] downloading image failed [json-pointer:/blocks/2]'],
      },
    })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    const posted = await createSlackClient('xoxb-teste', {
      fetch: fetcher,
    }).postMessage({ channelId: 'C01', text: 'oi' })

    expect(posted).toBeNull()
    expect(errors).toHaveBeenCalledWith(
      'Slack refused chat.postMessage',
      'invalid_blocks [ERROR] downloading image failed [json-pointer:/blocks/2]',
      'C01',
    )

    errors.mockRestore()
  })

  it('posts again without the images when Slack cannot fetch them', async () => {
    const { bodies, fetcher } = sequenceFetch([
      { error: 'invalid_blocks', ok: false },
      { channel: 'C01', ok: true, ts: '1.3' },
    ])
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    const posted = await createSlackClient('xoxb-teste', {
      fetch: fetcher,
    }).postMessage({ blocks: blocksWithImage, channelId: 'C01', text: 'oi' })

    expect(posted).toEqual({ channelId: 'C01', messageTs: '1.3' })
    expect(bodies.map(blockTypes)).toEqual([
      ['section', 'image'],
      ['section'],
    ])
    expect(errors).toHaveBeenCalledOnce()

    errors.mockRestore()
  })

  it('does not post again when Slack did not answer', async () => {
    let calls = 0
    const fetcher = (async () => {
      calls += 1

      throw new DOMException('The operation timed out.', 'TimeoutError')
    }) as unknown as typeof globalThis.fetch
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    const posted = await createSlackClient('xoxb-teste', {
      fetch: fetcher,
    }).postMessage({ blocks: blocksWithImage, channelId: 'C01', text: 'oi' })

    expect(posted).toBeNull()
    expect(calls).toBe(1)
    expect(errors).toHaveBeenCalledWith(
      'Slack refused chat.postMessage',
      'no_response',
      'C01',
    )

    errors.mockRestore()
  })

  it('does not post again when the refusal is not about the blocks', async () => {
    const { bodies, fetcher } = sequenceFetch([
      { error: 'channel_not_found', ok: false },
    ])
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    const posted = await createSlackClient('xoxb-teste', {
      fetch: fetcher,
    }).postMessage({ blocks: blocksWithImage, channelId: 'C01', text: 'oi' })

    expect(posted).toBeNull()
    expect(bodies).toHaveLength(1)

    errors.mockRestore()
  })

  it('does not post again when there is no image to drop', async () => {
    const { bodies, fetcher } = sequenceFetch([
      { error: 'invalid_blocks', ok: false },
    ])
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})

    const posted = await createSlackClient('xoxb-teste', {
      fetch: fetcher,
    }).postMessage({
      blocks: blocksWithImage.slice(0, 1),
      channelId: 'C01',
      text: 'oi',
    })

    expect(posted).toBeNull()
    expect(bodies).toHaveLength(1)

    errors.mockRestore()
  })

  it('returns null when Slack refuses', async () => {
    const { fetcher } = recordingFetch({ error: 'invalid_arguments', ok: false })

    const channel = await createSlackClient('xoxb-teste', {
      fetch: fetcher,
    }).channelInfo('C01')

    expect(channel).toBeNull()
  })

  it('reads the name and the face of whoever spoke', async () => {
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

  it('finds the Slack person behind an email', async () => {
    const { calls, fetcher } = recordingFetch({ ok: true, user: { id: 'U7' } })

    const id = await createSlackClient('xoxb-teste', {
      fetch: fetcher,
    }).userIdByEmail('ana@example.com')

    expect(id).toBe('U7')
    expect(calls[0].url).toBe('https://slack.com/api/users.lookupByEmail')
    expect(new URLSearchParams(calls[0].body).get('email')).toBe(
      'ana@example.com',
    )
  })

  it('gives up on the email lookup when Slack refuses it', async () => {
    const { fetcher } = recordingFetch({ ok: false, error: 'missing_scope' })

    await expect(
      createSlackClient('xoxb-teste', { fetch: fetcher }).userIdByEmail(
        'ana@example.com',
      ),
    ).resolves.toBeNull()
  })
})
