import { describe, expect, it } from 'vitest'

import { firstImageInBlocks, firstImageInContent } from './card-preview'

const notionColumns = [
  {
    type: 'columnList',
    children: [
      {
        type: 'column',
        children: [
          {
            type: 'image',
            props: { name: 'image', url: '/api/uploads/u/CRuoPm3ydFqFUkF8.bin' },
          },
        ],
      },
      {
        type: 'column',
        children: [
          { type: 'heading', props: { level: 1 }, content: [] },
          { type: 'paragraph', content: [] },
        ],
      },
    ],
  },
]

describe('card preview', () => {
  it('finds an image nested inside a column layout', () => {
    expect(firstImageInBlocks(notionColumns)).toBe(
      '/api/uploads/u/CRuoPm3ydFqFUkF8.bin',
    )
  })

  it('keeps the first image of the page in reading order', () => {
    expect(
      firstImageInBlocks([
        { type: 'paragraph', content: [] },
        { type: 'image', props: { url: 'https://example.org/first.png' } },
        { type: 'image', props: { url: 'https://example.org/second.png' } },
      ]),
    ).toBe('https://example.org/first.png')
  })

  it('ignores a block that is not an image', () => {
    expect(
      firstImageInBlocks([
        { type: 'video', props: { url: 'https://example.org/clip.mp4' } },
        { type: 'file', props: { url: 'https://example.org/sheet.csv' } },
      ]),
    ).toBeNull()
  })

  it('refuses an address the browser should not load', () => {
    expect(
      firstImageInBlocks([
        { type: 'image', props: { url: 'javascript:alert(1)' } },
      ]),
    ).toBeNull()
    expect(
      firstImageInBlocks([{ type: 'image', props: { url: '   ' } }]),
    ).toBeNull()
  })

  it('survives an image block without a url', () => {
    expect(firstImageInBlocks([{ type: 'image' }])).toBeNull()
    expect(firstImageInBlocks([{ type: 'image', props: {} }])).toBeNull()
  })

  it('reads the blocks out of the stored content', () => {
    expect(firstImageInContent(JSON.stringify(notionColumns))).toBe(
      '/api/uploads/u/CRuoPm3ydFqFUkF8.bin',
    )
  })

  it('returns nothing for an empty or broken content', () => {
    expect(firstImageInContent(null)).toBeNull()
    expect(firstImageInContent('')).toBeNull()
    expect(firstImageInContent('not json')).toBeNull()
  })
})
