import { describe, expect, it } from 'vitest'

import { parseDocumentContent } from './content'

describe('parseDocumentContent', () => {
  it('devolve um parágrafo vazio quando não há conteúdo', () => {
    expect(parseDocumentContent(null)).toEqual([{ type: 'paragraph' }])
  })

  it('devolve um parágrafo vazio quando o JSON está corrompido', () => {
    expect(parseDocumentContent('{')).toEqual([{ type: 'paragraph' }])
  })

  it('devolve um parágrafo vazio quando o documento salvo está vazio', () => {
    expect(parseDocumentContent('[]')).toEqual([{ type: 'paragraph' }])
  })

  it('mantém os blocos salvos', () => {
    const blocks = [{ type: 'heading', props: { level: 2 }, content: 'Olá' }]

    expect(parseDocumentContent(JSON.stringify(blocks))).toEqual(blocks)
  })
})
