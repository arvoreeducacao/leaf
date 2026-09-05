import { createHmac, timingSafeEqual } from 'node:crypto'

import { SLACK_SIGNATURE_WINDOW_SECONDS } from './config'

export type SignatureInput = Readonly<{
  secret: string
  timestamp: string
  signature: string
  body: string
  nowSeconds: number
}>

export function signBody(
  secret: string,
  timestamp: string,
  body: string,
): string {
  const digest = createHmac('sha256', secret)
    .update(`v0:${timestamp}:${body}`)
    .digest('hex')

  return `v0=${digest}`
}

export function isFreshTimestamp(
  timestamp: string,
  nowSeconds: number,
): boolean {
  const seconds = Number(timestamp)

  if (!Number.isFinite(seconds)) {
    return false
  }

  return Math.abs(nowSeconds - seconds) <= SLACK_SIGNATURE_WINDOW_SECONDS
}

export function verifySlackSignature(input: SignatureInput): boolean {
  if (!isFreshTimestamp(input.timestamp, input.nowSeconds)) {
    return false
  }

  const expected = Buffer.from(
    signBody(input.secret, input.timestamp, input.body),
    'utf8',
  )
  const presented = Buffer.from(input.signature, 'utf8')

  return (
    expected.length === presented.length && timingSafeEqual(expected, presented)
  )
}
