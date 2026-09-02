import { describe, expect, it } from 'vitest'

import {
  answerSegments,
  askQuestionMaxLength,
  buildAskContext,
  extractPassage,
  readAskQuestion,
  toAskSources,
} from '@/lib/ai-ask'

describe('readAskQuestion', () => {
  it('refuses what is not a question worth asking', () => {
    expect(readAskQuestion(undefined)).toBeNull()
    expect(readAskQuestion(42)).toBeNull()
    expect(readAskQuestion('  ')).toBeNull()
    expect(readAskQuestion('oi')).toBeNull()
    expect(readAskQuestion('a'.repeat(askQuestionMaxLength + 1))).toBeNull()
  })

  it('collapses the whitespace of what it accepts', () => {
    expect(readAskQuestion('  como   fica   o offline?  ')).toBe(
      'como fica o offline?',
    )
  })
})

describe('extractPassage', () => {
  it('returns the whole text when it already fits', () => {
    expect(extractPassage('  um texto   curto ', ['texto'], 100)).toBe(
      'um texto curto',
    )
  })

  it('takes the window around the first term it finds', () => {
    const body = `${'a'.repeat(400)} palavra-chave ${'b'.repeat(400)}`
    const passage = extractPassage(body, ['palavra-chave'], 100)

    expect(passage).toContain('palavra-chave')
    expect(passage.startsWith('…')).toBe(true)
    expect(passage.endsWith('…')).toBe(true)
    expect(passage.length).toBeLessThanOrEqual(102)
  })

  it('falls back to the beginning when no term appears', () => {
    const body = `abertura ${'c'.repeat(400)}`
    const passage = extractPassage(body, ['ausente'], 50)

    expect(passage.startsWith('abertura')).toBe(true)
    expect(passage.endsWith('…')).toBe(true)
  })

  it('ignores the case of the term', () => {
    const body = `${'d'.repeat(300)} Offline ${'e'.repeat(300)}`

    expect(extractPassage(body, ['offline'], 80)).toContain('Offline')
  })
})

describe('buildAskContext', () => {
  it('numbers the sources so the answer can cite them', () => {
    const sources = toAskSources(
      [
        { id: 'doc-1', title: 'Offline', body: 'o documento vive no navegador' },
        { id: 'doc-2', title: 'Busca', body: '' },
      ],
      ['offline'],
    )

    const context = buildAskContext(sources)

    expect(context).toContain('[1] Offline')
    expect(context).toContain('o documento vive no navegador')
    expect(context).toContain('[2] Busca')
    expect(context).toContain('(empty document)')
  })
})

describe('answerSegments', () => {
  it('keeps plain text in one piece', () => {
    expect(answerSegments('trinta dias de antecedência')).toEqual([
      { text: 'trinta dias de antecedência', strong: false },
    ])
  })

  it('turns what the model marked in bold into its own segment', () => {
    expect(answerSegments('pedir com **30 dias** de antecedência')).toEqual([
      { text: 'pedir com ', strong: false },
      { text: '30 dias', strong: true },
      { text: ' de antecedência', strong: false },
    ])
  })

  it('survives an answer still being written', () => {
    expect(answerSegments('a aprovação é do **gest')).toEqual([
      { text: 'a aprovação é do **gest', strong: false },
    ])
  })

  it('has nothing to show for an empty answer', () => {
    expect(answerSegments('')).toEqual([])
  })
})
