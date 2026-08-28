import { describe, expect, it } from 'vitest'

import {
  blocksToPlainText,
  countTextStats,
  statsFromBlocks,
} from '@/components/editor/text-stats'

describe('countTextStats', () => {
  it('conta zero num texto vazio', () => {
    expect(countTextStats('   \n  ')).toEqual({ words: 0, characters: 0 })
  })

  it('colapsa espaços repetidos antes de contar', () => {
    expect(countTextStats('  uma   frase  curta ')).toEqual({
      words: 3,
      characters: 15,
    })
  })
})

describe('blocksToPlainText', () => {
  it('junta o texto de blocos aninhados e de links', () => {
    const blocks = [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Leia o ' },
          {
            type: 'link',
            href: 'https://arvore.com.br',
            content: [{ type: 'text', text: 'guia' }],
          },
        ],
        children: [
          {
            type: 'bulletListItem',
            content: [{ type: 'text', text: 'primeiro item' }],
          },
        ],
      },
    ]

    expect(blocksToPlainText(blocks).replace(/\s+/g, ' ').trim()).toBe(
      'Leia o guia primeiro item',
    )
  })

  it('não quebra em bloco sem conteúdo', () => {
    expect(statsFromBlocks([{ type: 'image', props: { url: '/a.png' } }])).toEqual(
      { words: 0, characters: 0 },
    )
  })

  it('conta o texto das células de uma tabela', () => {
    const blocks = [
      {
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [
            {
              cells: [
                [{ type: 'text', text: 'Nome' }],
                [{ type: 'text', text: 'Turma' }],
              ],
            },
          ],
        },
      },
    ]

    expect(statsFromBlocks(blocks)).toEqual({ words: 2, characters: 10 })
  })
})
