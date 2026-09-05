import { describe, expect, it } from 'vitest'

import { isFreshTimestamp, signBody, verifySlackSignature } from './signature'

const SECRET = 'segredo-de-assinatura'
const BODY = '{"type":"event_callback"}'

describe('signBody', () => {
  it('assina no formato v0 do Slack', () => {
    expect(signBody(SECRET, '1700000000', BODY)).toMatch(/^v0=[0-9a-f]{64}$/)
  })

  it('muda a assinatura quando o corpo muda', () => {
    expect(signBody(SECRET, '1700000000', BODY)).not.toBe(
      signBody(SECRET, '1700000000', `${BODY} `),
    )
  })
})

describe('isFreshTimestamp', () => {
  it('aceita o que está dentro da janela', () => {
    expect(isFreshTimestamp('1700000000', 1_700_000_100)).toBe(true)
  })

  it('recusa o que passou da janela', () => {
    expect(isFreshTimestamp('1700000000', 1_700_000_600)).toBe(false)
  })

  it('recusa carimbo que não é número', () => {
    expect(isFreshTimestamp('agora', 1_700_000_000)).toBe(false)
  })
})

describe('verifySlackSignature', () => {
  const base = {
    body: BODY,
    nowSeconds: 1_700_000_010,
    secret: SECRET,
    timestamp: '1700000000',
  }

  it('aceita a assinatura correta', () => {
    expect(
      verifySlackSignature({
        ...base,
        signature: signBody(SECRET, base.timestamp, BODY),
      }),
    ).toBe(true)
  })

  it('recusa assinatura de outro segredo', () => {
    expect(
      verifySlackSignature({
        ...base,
        signature: signBody('outro', base.timestamp, BODY),
      }),
    ).toBe(false)
  })

  it('recusa assinatura de tamanho diferente', () => {
    expect(verifySlackSignature({ ...base, signature: 'v0=curta' })).toBe(false)
  })

  it('recusa quando o carimbo está velho, mesmo assinado', () => {
    expect(
      verifySlackSignature({
        ...base,
        nowSeconds: 1_700_001_000,
        signature: signBody(SECRET, base.timestamp, BODY),
      }),
    ).toBe(false)
  })
})
