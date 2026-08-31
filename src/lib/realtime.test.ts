import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  documentIdFromRoom,
  isDocumentIdShaped,
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

describe('sala do documento', () => {
  it('vai e volta do id para o nome da sala', () => {
    expect(realtimeRoomName('abc123')).toBe('doc:abc123')
    expect(documentIdFromRoom('doc:abc123')).toBe('abc123')
  })

  it('recusa sala fora do padrão', () => {
    expect(documentIdFromRoom('outro:abc')).toBeNull()
    expect(documentIdFromRoom('doc:')).toBeNull()
    expect(documentIdFromRoom('doc:../../etc/passwd')).toBeNull()
    expect(documentIdFromRoom(`doc:${'a'.repeat(65)}`)).toBeNull()
  })

  it('valida o formato do id que chega pelos endpoints internos', () => {
    expect(isDocumentIdShaped('abc-123_XYZ')).toBe(true)
    expect(isDocumentIdShaped('abc 123')).toBe(false)
    expect(isDocumentIdShaped(42)).toBe(false)
  })
})

describe('flag e segredo', () => {
  it('fica ligada por padrão fora de produção', () => {
    vi.stubEnv('LEAF_REALTIME', undefined)
    vi.stubEnv('NODE_ENV', 'development')

    expect(isRealtimeEnabled()).toBe(true)
  })

  it('exige opt-in explícito em produção', () => {
    vi.stubEnv('LEAF_REALTIME', undefined)
    vi.stubEnv('NODE_ENV', 'production')

    expect(isRealtimeEnabled()).toBe(false)

    vi.stubEnv('LEAF_REALTIME', 'true')

    expect(isRealtimeEnabled()).toBe(true)
  })

  it('desliga com LEAF_REALTIME=false', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('LEAF_REALTIME', 'false')

    expect(isRealtimeEnabled()).toBe(false)
  })

  it('só aceita chamada interna com o segredo certo', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('LEAF_REALTIME_SECRET', undefined)

    expect(hasValidRealtimeSecret(request('leaf-dev-realtime'))).toBe(true)
    expect(hasValidRealtimeSecret(request('outro'))).toBe(false)
    expect(hasValidRealtimeSecret(request(null))).toBe(false)

    vi.stubEnv('LEAF_REALTIME_SECRET', 'segredo-do-deploy')

    expect(hasValidRealtimeSecret(request('segredo-do-deploy'))).toBe(true)
    expect(hasValidRealtimeSecret(request('leaf-dev-realtime'))).toBe(false)
  })

  it('não aceita nenhuma chamada interna sem segredo em produção', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('LEAF_REALTIME_SECRET', undefined)

    expect(hasValidRealtimeSecret(request('leaf-dev-realtime'))).toBe(false)
  })

  it('usa a porta e a url configuradas', () => {
    vi.stubEnv('LEAF_REALTIME_PORT', undefined)
    vi.stubEnv('LEAF_REALTIME_URL', undefined)

    expect(realtimePort()).toBe(1234)
    expect(realtimeClientUrl()).toBe('ws://127.0.0.1:1234')

    vi.stubEnv('LEAF_REALTIME_PORT', '4321')

    expect(realtimeClientUrl()).toBe('ws://127.0.0.1:4321')

    vi.stubEnv('LEAF_REALTIME_URL', 'wss://leaf.example/colab')

    expect(realtimeClientUrl()).toBe('wss://leaf.example/colab')
  })
})

describe('identidade das pessoas na sala', () => {
  it('dá sempre a mesma cor para a mesma pessoa', () => {
    expect(realtimeColorFor('pessoa-1', 'light')).toBe(
      realtimeColorFor('pessoa-1', 'light'),
    )
    expect(realtimeColorFor('pessoa-1', 'dark')).not.toBe(
      realtimeColorFor('pessoa-1', 'light'),
    )
  })

  it('escolhe texto legível sobre a cor do cursor', () => {
    expect(realtimeTextColorFor(realtimeColorFor('pessoa-1', 'light'))).toBe(
      '#ffffff',
    )
    expect(realtimeTextColorFor(realtimeColorFor('pessoa-1', 'dark'))).toBe(
      '#02212a',
    )
  })

  it('monta as iniciais do nome', () => {
    expect(realtimeInitials('Ana Colaboradora')).toBe('AC')
    expect(realtimeInitials('Ana')).toBe('A')
    expect(realtimeInitials('   ')).toBe('?')
  })

  it('lê a presença do awareness ignorando estado sem usuário', () => {
    const states = new Map<number, Record<string, unknown>>([
      [7, { user: { id: 'u-1', name: 'Ana' } }],
      [3, { user: { id: 'u-2', name: '  ' } }],
      [9, { cursor: {} }],
    ])

    const peers = peersFromAwareness(states, 7, 'Alguém')

    expect(peers.map((peer) => peer.clientId)).toEqual([3, 7])
    expect(peers.map((peer) => peer.name)).toEqual(['Alguém', 'Ana'])
    expect(peers.find((peer) => peer.clientId === 7)?.isSelf).toBe(true)
    expect(peers.find((peer) => peer.clientId === 3)?.isSelf).toBe(false)
  })
})
