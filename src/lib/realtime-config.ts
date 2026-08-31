import {
  realtimeDefaultPort,
  realtimeDevSecret,
  realtimeSecretHeader,
} from '@/lib/realtime'

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

export function isRealtimeEnabled() {
  const flag = normalize(process.env.LEAF_REALTIME)

  if (flag.length === 0) {
    return process.env.NODE_ENV !== 'production'
  }

  return flag === '1' || flag === 'true' || flag === 'on'
}

export function realtimePort() {
  const port = Number(process.env.LEAF_REALTIME_PORT)

  return Number.isInteger(port) && port > 0 ? port : realtimeDefaultPort
}

export function realtimeClientUrl() {
  const configured = process.env.LEAF_REALTIME_URL?.trim()

  if (configured && configured.length > 0) {
    return configured
  }

  return `ws://127.0.0.1:${realtimePort()}`
}

export function realtimeSecret() {
  const secret = process.env.LEAF_REALTIME_SECRET?.trim()

  if (secret && secret.length > 0) {
    return secret
  }

  if (process.env.NODE_ENV === 'production') {
    return null
  }

  return realtimeDevSecret
}

export function hasValidRealtimeSecret(request: Request) {
  const expected = realtimeSecret()

  if (!expected) {
    return false
  }

  return request.headers.get(realtimeSecretHeader) === expected
}
