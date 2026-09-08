import { afterEach, describe, expect, it, vi } from 'vitest'

import { readFileSync } from 'node:fs'

import {
  documentIdFromRoom,
  isDocumentIdShaped,
  realtimeCloseCodes,
  realtimeCloseIsFinal,
  realtimeRoomName,
  realtimeSecretHeader,
} from './realtime'
import {
  hasValidRealtimeSecret,
  isRealtimeEnabled,
  realtimeClientUrl,
  realtimePort,
} from './realtime-config'
import {
  peersFromAwareness,
  realtimeColorFor,
  realtimeInitials,
  realtimeTextColorFor,
} from './realtime-user'

afterEach(() => {
  vi.unstubAllEnvs()
})

function request(secret: string | null) {
  return new Request('http://localhost/api/realtime/persist', {
    method: 'POST',
    headers: secret === null ? {} : { [realtimeSecretHeader]: secret },
  })
}

describe('document room', () => {
  it('round-trips between the id and the room name', () => {
    expect(realtimeRoomName('abc123')).toBe('doc:abc123')
    expect(documentIdFromRoom('doc:abc123')).toBe('abc123')
  })

  it('rejects a room outside the pattern', () => {
    expect(documentIdFromRoom('other:abc')).toBeNull()
    expect(documentIdFromRoom('doc:')).toBeNull()
    expect(documentIdFromRoom('doc:../../etc/passwd')).toBeNull()
    expect(documentIdFromRoom(`doc:${'a'.repeat(65)}`)).toBeNull()
  })

  it('validates the shape of the id coming from the internal endpoints', () => {
    expect(isDocumentIdShaped('abc-123_XYZ')).toBe(true)
    expect(isDocumentIdShaped('abc 123')).toBe(false)
    expect(isDocumentIdShaped(42)).toBe(false)
  })
})

describe('flag and secret', () => {
  it('is on by default outside production', () => {
    vi.stubEnv('LEAF_REALTIME', undefined)
    vi.stubEnv('NODE_ENV', 'development')

    expect(isRealtimeEnabled()).toBe(true)
  })

  it('requires an explicit opt-in in production', () => {
    vi.stubEnv('LEAF_REALTIME', undefined)
    vi.stubEnv('NODE_ENV', 'production')

    expect(isRealtimeEnabled()).toBe(false)

    vi.stubEnv('LEAF_REALTIME', 'true')

    expect(isRealtimeEnabled()).toBe(true)
  })

  it('turns off with LEAF_REALTIME=false', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('LEAF_REALTIME', 'false')

    expect(isRealtimeEnabled()).toBe(false)
  })

  it('only accepts an internal call with the right secret', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('LEAF_REALTIME_SECRET', undefined)

    expect(hasValidRealtimeSecret(request('leaf-dev-realtime'))).toBe(true)
    expect(hasValidRealtimeSecret(request('other'))).toBe(false)
    expect(hasValidRealtimeSecret(request(null))).toBe(false)

    vi.stubEnv('LEAF_REALTIME_SECRET', 'deploy-secret')

    expect(hasValidRealtimeSecret(request('deploy-secret'))).toBe(true)
    expect(hasValidRealtimeSecret(request('leaf-dev-realtime'))).toBe(false)
  })

  it('accepts no internal call without a secret in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('LEAF_REALTIME_SECRET', undefined)

    expect(hasValidRealtimeSecret(request('leaf-dev-realtime'))).toBe(false)
  })

  it('uses the configured port and url', () => {
    vi.stubEnv('LEAF_REALTIME_PORT', undefined)
    vi.stubEnv('LEAF_REALTIME_URL', undefined)

    expect(realtimePort()).toBe(1234)
    expect(realtimeClientUrl()).toBe('ws://127.0.0.1:1234')

    vi.stubEnv('LEAF_REALTIME_PORT', '4321')

    expect(realtimeClientUrl()).toBe('ws://127.0.0.1:4321')

    vi.stubEnv('LEAF_REALTIME_URL', 'wss://leaf.example/collab')

    expect(realtimeClientUrl()).toBe('wss://leaf.example/collab')
  })
})

describe('identity of the people in the room', () => {
  it('always gives the same color to the same person', () => {
    expect(realtimeColorFor('person-1', 'light')).toBe(
      realtimeColorFor('person-1', 'light'),
    )
    expect(realtimeColorFor('person-1', 'dark')).not.toBe(
      realtimeColorFor('person-1', 'light'),
    )
  })

  it('picks readable text over the cursor color', () => {
    expect(realtimeTextColorFor(realtimeColorFor('person-1', 'light'))).toBe(
      '#ffffff',
    )
    expect(realtimeTextColorFor(realtimeColorFor('person-1', 'dark'))).toBe(
      '#02212a',
    )
  })

  it('builds the initials of the name', () => {
    expect(realtimeInitials('Ana Collaborator')).toBe('AC')
    expect(realtimeInitials('Ana')).toBe('A')
    expect(realtimeInitials('   ')).toBe('?')
  })

  it('reads presence from awareness ignoring state without a user', () => {
    const states = new Map<number, Record<string, unknown>>([
      [7, { user: { id: 'u-1', name: 'Ana' } }],
      [3, { user: { id: 'u-2', name: '  ' } }],
      [9, { cursor: {} }],
    ])

    const peers = peersFromAwareness(states, 7, 'Someone')

    expect(peers.map((peer) => peer.clientId)).toEqual([3, 7])
    expect(peers.map((peer) => peer.name)).toEqual(['Someone', 'Ana'])
    expect(peers.find((peer) => peer.clientId === 7)?.isSelf).toBe(true)
    expect(peers.find((peer) => peer.clientId === 3)?.isSelf).toBe(false)
  })
})

describe('realtimeCloseIsFinal', () => {
  it('marks the range the websocket client refuses to retry', () => {
    expect(realtimeCloseIsFinal(4400)).toBe(true)
    expect(realtimeCloseIsFinal(4499)).toBe(true)
    expect(realtimeCloseIsFinal(4399)).toBe(false)
    expect(realtimeCloseIsFinal(4500)).toBe(false)
    expect(realtimeCloseIsFinal(1006)).toBe(false)
  })

  it('only ends the session for reasons a retry cannot fix', () => {
    expect(realtimeCloseIsFinal(realtimeCloseCodes.forbidden)).toBe(true)
    expect(realtimeCloseIsFinal(realtimeCloseCodes.notFound)).toBe(true)
    expect(realtimeCloseIsFinal(realtimeCloseCodes.unreadable)).toBe(true)
  })

  it('keeps retrying when the server could not answer, which a deploy causes', () => {
    expect(realtimeCloseIsFinal(realtimeCloseCodes.unavailable)).toBe(false)
  })

  it('agrees with the codes the collaboration server actually sends', () => {
    const server = readFileSync('scripts/dev-realtime.mjs', 'utf8')

    for (const [name, code] of Object.entries(realtimeCloseCodes)) {
      expect(server).toContain(`= ${code}`)
      expect(name.length).toBeGreaterThan(0)
    }
  })
})
