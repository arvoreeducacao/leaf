import { describe, expect, it } from 'vitest'

import { challengeOf, parseMessageEvent } from './events'

function callback(event: Record<string, unknown>) {
  return { event, type: 'event_callback' }
}

describe('challengeOf', () => {
  it('returns the challenge of the URL verification', () => {
    expect(challengeOf({ challenge: 'abc', type: 'url_verification' })).toBe(
      'abc',
    )
  })

  it('returns null for any other type', () => {
    expect(challengeOf(callback({ type: 'message' }))).toBeNull()
  })
})

describe('parseMessageEvent', () => {
  it('reads a thread reply', () => {
    expect(
      parseMessageEvent(
        callback({
          channel: 'C01',
          text: 'em qualquer livro',
          thread_ts: '1.1',
          ts: '2.2',
          type: 'message',
          user: 'U9',
        }),
      ),
    ).toEqual({
      botId: null,
      channelId: 'C01',
      messageTs: '2.2',
      text: 'em qualquer livro',
      threadTs: '1.1',
      userId: 'U9',
    })
  })

  it('marks a message from a bot', () => {
    const parsed = parseMessageEvent(
      callback({
        bot_id: 'B1',
        channel: 'C01',
        text: 'oi',
        thread_ts: '1.1',
        ts: '2.2',
        type: 'message',
      }),
    )

    expect(parsed?.botId).toBe('B1')
  })

  it('reads the edited message out of a message_changed', () => {
    const parsed = parseMessageEvent(
      callback({
        channel: 'C01',
        message: {
          text: 'corrigido',
          thread_ts: '1.1',
          ts: '2.2',
          type: 'message',
          user: 'U9',
        },
        subtype: 'message_changed',
        ts: '3.3',
        type: 'message',
      }),
    )

    expect(parsed).toMatchObject({ messageTs: '2.2', text: 'corrigido' })
  })

  it('ignores a subtype that is not relayed', () => {
    expect(
      parseMessageEvent(
        callback({
          channel: 'C01',
          subtype: 'channel_join',
          ts: '2.2',
          type: 'message',
        }),
      ),
    ).toBeNull()
  })

  it('ignores an event that is not a message', () => {
    expect(parseMessageEvent(callback({ type: 'reaction_added' }))).toBeNull()
  })

  it('ignores a body that is not an event_callback', () => {
    expect(parseMessageEvent({ type: 'url_verification' })).toBeNull()
  })
})
