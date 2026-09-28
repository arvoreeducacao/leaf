import { describe, expect, it, vi } from 'vitest'

vi.mock('@/db', async () => {
  const { createTestDb } = await import('@/db/testing')

  return createTestDb()
})

import { rankMentionCandidates } from '@/lib/mention-people'

const people = [
  { email: 'bruno@example.com', image: null, name: 'Bruno Souza', userId: 'b' },
  { email: 'ana@example.com', image: null, name: 'Ana Lima', userId: 'a' },
  { email: 'jl@example.com', image: null, name: 'João Luana', userId: 'j' },
  { email: 'luana@example.com', image: null, name: 'Luana Reis', userId: 'l' },
]

function ids(query: string, limit?: number) {
  return rankMentionCandidates(people, query, limit).map(
    (person) => person.userId,
  )
}

describe('rankMentionCandidates', () => {
  it('lists everyone alphabetically for an empty query', () => {
    expect(ids('')).toEqual(['a', 'b', 'j', 'l'])
  })

  it('puts names that start with the query before other matches', () => {
    expect(ids('lu')).toEqual(['l', 'j'])
  })

  it('matches without accents and by the email handle', () => {
    expect(ids('joao')).toEqual(['j'])
    expect(ids('jl')).toEqual(['j'])
  })

  it('drops who does not match and respects the limit', () => {
    expect(ids('zzz')).toEqual([])
    expect(ids('', 2)).toEqual(['a', 'b'])
  })
})
