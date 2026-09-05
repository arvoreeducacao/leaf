import { describe, expect, it } from 'vitest'

import {
  type Person,
  matchPerson,
  personOptions,
  reconcileColumn,
} from './people'

const roster: Array<Person> = [
  { id: 'u1', name: 'Rafael Andrade', email: 'rafael.andrade@example.com' },
  { id: 'u2', name: 'Ricardo raposo', email: 'ricardo.raposo@example.com' },
  { id: 'u3', name: 'João Barros', email: 'joao.barros@example.com' },
  { id: 'u4', name: 'Joao Leal', email: 'joao@example.com' },
  { id: 'u5', name: 'Jotta', email: 'joao.cunha@example.com' },
  { id: 'u6', name: 'Mateus', email: 'mateus.coutinho@example.com' },
  { id: 'u7', name: 'Carlos Mees', email: 'carlos@example.com' },
  { id: 'u8', name: 'Vitor Mendes', email: 'vitor.mendes@example.com' },
  { id: 'u9', name: 'Vitor Piovezan', email: 'vitor.piovezan@example.com' },
]

describe('matchPerson', () => {
  it('matches by the full name, ignoring accent and case', () => {
    expect(matchPerson('joao barros', roster)).toEqual({
      kind: 'matched',
      personId: 'u3',
    })
  })

  it('matches by the first name when it belongs to a single person', () => {
    expect(matchPerson('Rafael', roster)).toEqual({
      kind: 'matched',
      personId: 'u1',
    })
  })

  it('matches by the last name when it belongs to a single person', () => {
    expect(matchPerson('Raposo', roster)).toEqual({
      kind: 'matched',
      personId: 'u2',
    })
  })

  it('matches by the local part of the email when the name does not help', () => {
    expect(matchPerson('coutinho', roster)).toEqual({
      kind: 'matched',
      personId: 'u6',
    })
  })

  it('matches by the whole email', () => {
    expect(matchPerson('vitor.mendes@example.com', roster)).toEqual({
      kind: 'matched',
      personId: 'u8',
    })
  })

  it('returns ambiguous, and never picks, when there is more than one candidate', () => {
    const match = matchPerson('Vitor', roster)

    expect(match.kind).toBe('ambiguous')
    expect(match.kind === 'ambiguous' && [...match.candidateIds].sort()).toEqual(
      ['u8', 'u9'],
    )
  })

  it('does not invent a person for a nickname that matches nobody', () => {
    expect(matchPerson('Carlinhos', roster)).toEqual({ kind: 'unmatched' })
  })

  it('an exact name beats whoever only matches part of the name', () => {
    expect(matchPerson('Jotta', roster)).toEqual({
      kind: 'matched',
      personId: 'u5',
    })
  })

  it('empty text matches nobody', () => {
    expect(matchPerson('   ', roster)).toEqual({ kind: 'unmatched' })
  })
})

describe('reconcileColumn', () => {
  it('separates what matched, what needs a person and what has no candidate', () => {
    const result = reconcileColumn(
      ['Rafael', 'Raposo', 'Joaozinho', 'Coutinho', 'Carlinhos', 'Vitu'],
      roster,
    )

    expect(result.resolved).toEqual({
      Rafael: 'u1',
      Raposo: 'u2',
      Coutinho: 'u6',
    })
    expect(result.unmatched).toEqual(['Joaozinho', 'Carlinhos', 'Vitu'])
    expect(result.pending).toEqual([])
  })

  it('gathers the candidates when the text is ambiguous', () => {
    const result = reconcileColumn(['Vitor'], roster)

    expect(result.resolved).toEqual({})
    expect(result.pending).toHaveLength(1)
    expect([...result.pending[0].candidateIds].sort()).toEqual(['u8', 'u9'])
  })

  it('does not repeat the same text twice', () => {
    const result = reconcileColumn(['Rafael', 'Rafael', ' Rafael '], roster)

    expect(Object.keys(result.resolved)).toEqual(['Rafael'])
  })
})

describe('personOptions', () => {
  it('becomes an option list carrying the person id', () => {
    const options = personOptions(roster.slice(0, 2))

    expect(options.map((option) => option.id)).toEqual(['u1', 'u2'])
    expect(options[0].name).toBe('Rafael Andrade')
  })
})
