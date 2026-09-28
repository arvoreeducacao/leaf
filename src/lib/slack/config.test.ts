import { afterEach, describe, expect, it, vi } from 'vitest'

import { isSlackMentionDmEnabled, parseChannelRef } from './config'

describe('parseChannelRef', () => {
  it('accepts the channel id', () => {
    expect(parseChannelRef('C01DB3YUUEQ')).toBe('C01DB3YUUEQ')
  })

  it('accepts the channel archive link', () => {
    expect(
      parseChannelRef('https://leianaarvore.slack.com/archives/C01DB3YUUEQ'),
    ).toBe('C01DB3YUUEQ')
  })

  it('accepts a link that ends on a message', () => {
    expect(
      parseChannelRef(
        'https://leianaarvore.slack.com/archives/C01DB3YUUEQ/p1788525945625709',
      ),
    ).toBe('C01DB3YUUEQ')
  })

  it('rejects a channel name', () => {
    expect(parseChannelRef('#feedbacks-e-duvidas-produto')).toBeNull()
  })

  it('rejects a lookalike domain', () => {
    expect(
      parseChannelRef('https://leianaarvore.slack.com.evil.test/archives/C01AB'),
    ).toBeNull()
  })

  it('rejects an empty reference', () => {
    expect(parseChannelRef('   ')).toBeNull()
  })
})

describe('isSlackMentionDmEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('stays off unless the flag is set', () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-teste')
    vi.stubEnv('LEAF_SLACK_MENTION_DMS', '')

    expect(isSlackMentionDmEnabled()).toBe(false)
  })

  it('turns on with the flag and a bot token', () => {
    vi.stubEnv('SLACK_BOT_TOKEN', 'xoxb-teste')
    vi.stubEnv('LEAF_SLACK_MENTION_DMS', 'true')

    expect(isSlackMentionDmEnabled()).toBe(true)
  })

  it('stays off without a bot token even with the flag', () => {
    vi.stubEnv('SLACK_BOT_TOKEN', '')
    vi.stubEnv('LEAF_SLACK_MENTION_DMS', 'true')

    expect(isSlackMentionDmEnabled()).toBe(false)
  })
})
