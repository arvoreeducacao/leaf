import { describe, expect, it } from 'vitest'

import { parseChannelRef } from './config'

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
