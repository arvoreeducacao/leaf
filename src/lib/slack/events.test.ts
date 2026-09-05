import { describe, expect, it } from 'vitest'

import { challengeOf, parseMessageEvent } from './events'

function callback(event: Record<string, unknown>) {
  return { event, type: 'event_callback' }
}

describe('challengeOf', () => {
  it('devolve o desafio da verificação de URL', () => {
    expect(challengeOf({ challenge: 'abc', type: 'url_verification' })).toBe(
      'abc',
    )
  })

  it('devolve nulo para outro tipo', () => {
    expect(challengeOf(callback({ type: 'message' }))).toBeNull()
  })
})

describe('parseMessageEvent', () => {
  it('lê uma resposta de thread', () => {
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

  it('marca mensagem de bot', () => {
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

  it('lê a mensagem editada de um message_changed', () => {
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

  it('ignora subtipo que não relaya', () => {
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

  it('ignora evento que não é mensagem', () => {
    expect(parseMessageEvent(callback({ type: 'reaction_added' }))).toBeNull()
  })

  it('ignora corpo que não é event_callback', () => {
    expect(parseMessageEvent({ type: 'url_verification' })).toBeNull()
  })
})
