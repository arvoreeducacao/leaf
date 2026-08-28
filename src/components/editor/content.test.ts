import { describe, expect, it } from 'vitest'

import { parseDocumentContent, readDocumentContent } from './content'

describe('readDocumentContent', () => {
  it('devolve um parágrafo vazio quando não há conteúdo', () => {
    expect(readDocumentContent(null)).toEqual({
      status: 'ok',
      blocks: [{ type: 'paragraph' }],
    })
  })

  it('devolve um parágrafo vazio quando o documento salvo está vazio', () => {
    expect(readDocumentContent('[]')).toEqual({
      status: 'ok',
      blocks: [{ type: 'paragraph' }],
    })
  })

  it('marca como ilegível quando o JSON está corrompido', () => {
    expect(readDocumentContent('{')).toEqual({ status: 'unreadable' })
  })

  it('marca como ilegível quando o JSON não é uma lista de blocos', () => {
    expect(readDocumentContent('{"a":1}')).toEqual({ status: 'unreadable' })
    expect(readDocumentContent('"texto"')).toEqual({ status: 'unreadable' })
  })

  it('mantém os blocos salvos', () => {
    const blocks = [{ type: 'heading', props: { level: 2 }, content: 'Olá' }]

    expect(readDocumentContent(JSON.stringify(blocks))).toEqual({
      status: 'ok',
      blocks,
    })
  })
})

describe('parseDocumentContent', () => {
  it('devolve um parágrafo vazio quando o conteúdo é ilegível', () => {
    expect(parseDocumentContent('{')).toEqual([{ type: 'paragraph' }])
  })

  it('mantém os blocos salvos', () => {
    const blocks = [{ type: 'heading', props: { level: 2 }, content: 'Olá' }]

    expect(parseDocumentContent(JSON.stringify(blocks))).toEqual(blocks)
  })
})
