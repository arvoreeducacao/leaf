import { describe, expect, it } from 'vitest'

import {
  blocksToPlainText,
  countTextStats,
  statsFromBlocks,
} from '@/components/editor/text-stats'

describe('countTextStats', () => {
  it('counts zero on an empty text', () => {
    expect(countTextStats('   \n  ')).toEqual({ words: 0, characters: 0 })
  })

  it('collapses repeated whitespace before counting', () => {
    expect(countTextStats('  one   tiny  phrase ')).toEqual({
      words: 3,
      characters: 15,
    })
  })
})

describe('blocksToPlainText', () => {
  it('joins the text of nested blocks and links', () => {
    const blocks = [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Read the ' },
          {
            type: 'link',
            href: 'https://example.com',
            content: [{ type: 'text', text: 'guide' }],
          },
        ],
        children: [
          {
            type: 'bulletListItem',
            content: [{ type: 'text', text: 'first item' }],
          },
        ],
      },
    ]

    expect(blocksToPlainText(blocks).replace(/\s+/g, ' ').trim()).toBe(
      'Read the guide first item',
    )
  })

  it('does not break on a block without content', () => {
    expect(statsFromBlocks([{ type: 'image', props: { url: '/a.png' } }])).toEqual(
      { words: 0, characters: 0 },
    )
  })

  it('counts the text of the cells of a table', () => {
    const blocks = [
      {
        type: 'table',
        content: {
          type: 'tableContent',
          rows: [
            {
              cells: [
                [{ type: 'text', text: 'Name' }],
                [{ type: 'text', text: 'Group' }],
              ],
            },
          ],
        },
      },
    ]

    expect(statsFromBlocks(blocks)).toEqual({ words: 2, characters: 10 })
  })
})
