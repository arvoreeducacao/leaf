import { describe, expect, it } from 'vitest'

import {
  type Person,
  matchPerson,
  personOptions,
  reconcileColumn,
} from './people'

const roster: Array<Person> = [
  { id: 'u1', name: 'Rafael Andrade', email: 'rafael.andrade@arvore.com.br' },
  { id: 'u2', name: 'Ricardo raposo', email: 'ricardo.raposo@arvore.com.br' },
  { id: 'u3', name: 'João Barros', email: 'joao.barros@arvore.com.br' },
  { id: 'u4', name: 'Joao Leal', email: 'joao@arvore.com.br' },
  { id: 'u5', name: 'Jotta', email: 'joao.cunha@arvore.com.br' },
  { id: 'u6', name: 'Mateus', email: 'mateus.coutinho@arvore.com.br' },
  { id: 'u7', name: 'Carlos Mees', email: 'carlos@arvore.com.br' },
  { id: 'u8', name: 'Vitor Mendes', email: 'vitor.mendes@arvore.com.br' },
  { id: 'u9', name: 'Vitor Piovezan', email: 'vitor.piovezan@arvore.com.br' },
]

describe('matchPerson', () => {
  it('casa pelo nome completo, ignorando acento e caixa', () => {
    expect(matchPerson('joao barros', roster)).toEqual({
      kind: 'matched',
      personId: 'u3',
    })
  })

  it('casa pelo primeiro nome quando ele é de uma pessoa só', () => {
    expect(matchPerson('Rafael', roster)).toEqual({
      kind: 'matched',
      personId: 'u1',
    })
  })

  it('casa pelo sobrenome quando ele é de uma pessoa só', () => {
    expect(matchPerson('Raposo', roster)).toEqual({
      kind: 'matched',
      personId: 'u2',
    })
  })

  it('casa pela parte local do email quando o nome não ajuda', () => {
    expect(matchPerson('coutinho', roster)).toEqual({
      kind: 'matched',
      personId: 'u6',
    })
  })

  it('casa pelo email inteiro', () => {
    expect(matchPerson('vitor.mendes@arvore.com.br', roster)).toEqual({
      kind: 'matched',
      personId: 'u8',
    })
  })

  it('devolve ambíguo, e nunca escolhe, quando há mais de um candidato', () => {
    const match = matchPerson('Vitor', roster)

    expect(match.kind).toBe('ambiguous')
    expect(match.kind === 'ambiguous' && [...match.candidateIds].sort()).toEqual(
      ['u8', 'u9'],
    )
  })

  it('não inventa pessoa para apelido que não bate com ninguém', () => {
    expect(matchPerson('Carlinhos', roster)).toEqual({ kind: 'unmatched' })
  })

  it('nome exato ganha de quem só bate por parte do nome', () => {
    expect(matchPerson('Jotta', roster)).toEqual({
      kind: 'matched',
      personId: 'u5',
    })
  })

  it('texto vazio não casa com ninguém', () => {
    expect(matchPerson('   ', roster)).toEqual({ kind: 'unmatched' })
  })
})

describe('reconcileColumn', () => {
  it('separa o que casou, o que precisa de gente e o que não tem candidato', () => {
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

  it('junta os candidatos quando o texto é ambíguo', () => {
    const result = reconcileColumn(['Vitor'], roster)

    expect(result.resolved).toEqual({})
    expect(result.pending).toHaveLength(1)
    expect([...result.pending[0].candidateIds].sort()).toEqual(['u8', 'u9'])
  })

  it('não repete o mesmo texto duas vezes', () => {
    const result = reconcileColumn(['Rafael', 'Rafael', ' Rafael '], roster)

    expect(Object.keys(result.resolved)).toEqual(['Rafael'])
  })
})

describe('personOptions', () => {
  it('vira lista de opção com o id da pessoa', () => {
    const options = personOptions(roster.slice(0, 2))

    expect(options.map((option) => option.id)).toEqual(['u1', 'u2'])
    expect(options[0].name).toBe('Rafael Andrade')
  })
})
