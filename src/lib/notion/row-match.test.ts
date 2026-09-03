import { describe, expect, it } from 'vitest'

import { createRowMatcher, normalizeRowTitle } from '@/lib/notion/row-match'

describe('normalizeRowTitle', () => {
  it('folds accents, case, emoji and punctuation', () => {
    expect(normalizeRowTitle('🚀 Atualização do App!')).toBe(
      normalizeRowTitle('atualizacao do app'),
    )
  })
})

describe('createRowMatcher', () => {
  it('matches exact titles regardless of accents', () => {
    const matcher = createRowMatcher([{ id: 'a', title: 'Avaliação leitora' }])

    expect(matcher.take('avaliacao LEITORA')).toBe('a')
    expect(matcher.take('avaliacao LEITORA')).toBeNull()
  })

  it('matches a truncated file title as a prefix of the full csv title', () => {
    const matcher = createRowMatcher([
      {
        id: 'long',
        title: 'Dúvida sobre varios ID do mesmo cliente aparecendo',
      },
      { id: 'other', title: 'Gerenciamento de atividades' },
    ])

    expect(
      matcher.take(
        'Dúvida sobre varios ID do mesmo cliente aparecendo no gerenciar',
      ),
    ).toBe('long')
  })

  it('refuses ambiguous prefixes', () => {
    const matcher = createRowMatcher([
      { id: 'a', title: 'Sugestão de melhoria no app' },
      { id: 'b', title: 'Sugestão de melhoria no app da BibliON' },
    ])

    expect(matcher.take('Sugestão de melhoria no app da BibliON v2')).toBe('b')
  })

  it('ignores very short prefixes', () => {
    const matcher = createRowMatcher([{ id: 'a', title: 'FLORA IA' }])

    expect(matcher.take('FLORA IA para consultar cronogramas')).toBeNull()
  })
})
