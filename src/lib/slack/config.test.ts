import { describe, expect, it } from 'vitest'

import { parseChannelRef } from './config'

describe('parseChannelRef', () => {
  it('aceita o id do canal', () => {
    expect(parseChannelRef('C01DB3YUUEQ')).toBe('C01DB3YUUEQ')
  })

  it('aceita o link de arquivo do canal', () => {
    expect(
      parseChannelRef('https://leianaarvore.slack.com/archives/C01DB3YUUEQ'),
    ).toBe('C01DB3YUUEQ')
  })

  it('aceita link com mensagem no fim', () => {
    expect(
      parseChannelRef(
        'https://leianaarvore.slack.com/archives/C01DB3YUUEQ/p1788525945625709',
      ),
    ).toBe('C01DB3YUUEQ')
  })

  it('recusa nome de canal', () => {
    expect(parseChannelRef('#feedbacks-e-duvidas-produto')).toBeNull()
  })

  it('recusa domínio parecido', () => {
    expect(
      parseChannelRef('https://leianaarvore.slack.com.evil.test/archives/C01AB'),
    ).toBeNull()
  })

  it('recusa vazio', () => {
    expect(parseChannelRef('   ')).toBeNull()
  })
})
