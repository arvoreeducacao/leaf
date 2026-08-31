import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import { realtimeFragmentName } from './realtime'
import {
  contentFromRealtimeState,
  seedUpdateFromContent,
} from './realtime-document'

const sample = JSON.stringify([
  {
    id: 'bloco-1',
    type: 'heading',
    props: { level: 1 },
    content: [{ type: 'text', text: 'Colaboração', styles: {} }],
    children: [],
  },
  {
    id: 'bloco-2',
    type: 'paragraph',
    props: {},
    content: [{ type: 'text', text: 'Duas pessoas no mesmo texto', styles: {} }],
    children: [],
  },
])

function roundTrip(content: string | null) {
  const seed = seedUpdateFromContent(content)

  if (seed.status !== 'ok') {
    throw new Error('semente inesperadamente ilegível')
  }

  return contentFromRealtimeState(seed.update)
}

describe('seedUpdateFromContent', () => {
  it('gera o mesmo documento para o mesmo conteúdo', () => {
    expect(roundTrip(sample)).toBe(roundTrip(sample))
  })

  it('duplica o conteúdo se duas sementes forem aplicadas na mesma sala', () => {
    const first = seedUpdateFromContent(sample)
    const second = seedUpdateFromContent(sample)

    if (first.status !== 'ok' || second.status !== 'ok') {
      throw new Error('semente inesperadamente ilegível')
    }

    const doc = new Y.Doc({ gc: true })

    Y.applyUpdate(doc, first.update)
    Y.applyUpdate(doc, second.update)

    const fragment = doc.getXmlFragment(realtimeFragmentName).toString()

    doc.destroy()

    expect(fragment.split('<blockgroup>').length - 1).toBe(2)
  })

  it('preserva texto e tipos no ida e volta', () => {
    const result = roundTrip(sample)

    expect(result).not.toBeNull()

    const blocks = JSON.parse(result as string) as Array<{
      type: string
      content: Array<{ text: string }>
    }>

    expect(blocks.map((block) => block.type)).toEqual(['heading', 'paragraph'])
    expect(blocks[0].content[0].text).toBe('Colaboração')
    expect(blocks[1].content[0].text).toBe('Duas pessoas no mesmo texto')
  })

  it('semeia um parágrafo vazio para documento sem conteúdo', () => {
    const result = roundTrip(null)

    expect(result).not.toBeNull()

    const blocks = JSON.parse(result as string) as Array<{ type: string }>

    expect(blocks).toHaveLength(1)
    expect(blocks[0].type).toBe('paragraph')
  })

  it('recusa conteúdo ilegível em vez de apagar o documento', () => {
    expect(seedUpdateFromContent('{ nao é json').status).toBe('unreadable')
  })
})

describe('contentFromRealtimeState', () => {
  it('devolve null quando o estado não é um update do Yjs', () => {
    expect(contentFromRealtimeState(new Uint8Array([9, 9, 9, 9]))).toBeNull()
  })
})
