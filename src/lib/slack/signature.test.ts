import { describe, expect, it } from 'vitest'

import { isFreshTimestamp, signBody, verifySlackSignature } from './signature'

const SECRET = 'segredo-de-assinatura'
const BODY = '{"type":"event_callback"}'

describe('signBody', () => {
  it('signs in the v0 format of Slack', () => {
    expect(signBody(SECRET, '1700000000', BODY)).toMatch(/^v0=[0-9a-f]{64}$/)
  })

  it('changes the signature when the body changes', () => {
    expect(signBody(SECRET, '1700000000', BODY)).not.toBe(
      signBody(SECRET, '1700000000', `${BODY} `),
    )
  })
})

describe('isFreshTimestamp', () => {
  it('accepts what falls inside the window', () => {
    expect(isFreshTimestamp('1700000000', 1_700_000_100)).toBe(true)
  })

  it('rejects what fell outside the window', () => {
    expect(isFreshTimestamp('1700000000', 1_700_000_600)).toBe(false)
  })

  it('rejects a stamp that is not a number', () => {
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

  it('accepts the right signature', () => {
    expect(
      verifySlackSignature({
        ...base,
        signature: signBody(SECRET, base.timestamp, BODY),
      }),
    ).toBe(true)
  })

  it('rejects a signature from another secret', () => {
    expect(
      verifySlackSignature({
        ...base,
        signature: signBody('outro', base.timestamp, BODY),
      }),
    ).toBe(false)
  })

  it('rejects a signature of a different length', () => {
    expect(verifySlackSignature({ ...base, signature: 'v0=curta' })).toBe(false)
  })

  it('rejects an old stamp even when it is signed', () => {
    expect(
      verifySlackSignature({
        ...base,
        nowSeconds: 1_700_001_000,
        signature: signBody(SECRET, base.timestamp, BODY),
      }),
    ).toBe(false)
  })
})
