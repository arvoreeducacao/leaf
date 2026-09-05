import { describe, expect, it } from 'vitest'

import { convertLegacyLinkBlocks } from './embed-legacy-links'
import { isEmbeddableUrl } from './embed-providers'

function linkParagraph(id: string, href: string) {
  return {
    children: [],
    content: [
      { content: [{ styles: {}, text: href, type: 'text' }], href, type: 'link' },
    ],
    id,
    props: {},
    type: 'paragraph',
  }
}

describe('convertLegacyLinkBlocks', () => {
  it('turns a paragraph that is only a figma link into an embed and keeps its id', () => {
    const result = convertLegacyLinkBlocks([
      linkParagraph('b1', 'https://www.figma.com/design/abc123XY/Leaf'),
    ], isEmbeddableUrl)

    expect(result.converted).toHaveLength(1)
    expect(result.blocks[0]).toEqual({
      children: [],
      id: 'b1',
      props: { caption: '', url: 'https://www.figma.com/design/abc123XY/Leaf' },
      type: 'embed',
    })
  })

  it('accepts a bare url that was never turned into a link', () => {
    const result = convertLegacyLinkBlocks([
      {
        children: [],
        content: [
          { styles: {}, text: 'https://youtu.be/dQw4w9WgXcQ', type: 'text' },
        ],
        id: 'b2',
        props: {},
        type: 'paragraph',
      },
    ], isEmbeddableUrl)

    expect(result.converted).toHaveLength(1)
    expect(result.blocks[0].type).toBe('embed')
  })

  it('leaves alone a link that lives inside a sentence', () => {
    const result = convertLegacyLinkBlocks([
      {
        children: [],
        content: [
          { styles: {}, text: 'o fluxo está em ', type: 'text' },
          {
            content: [],
            href: 'https://www.figma.com/design/abc123XY/Leaf',
            type: 'link',
          },
        ],
        id: 'b3',
        props: {},
        type: 'paragraph',
      },
    ], isEmbeddableUrl)

    expect(result.converted).toEqual([])
    expect(result.blocks[0].type).toBe('paragraph')
  })

  it('leaves alone a link nothing can frame', () => {
    const result = convertLegacyLinkBlocks([
      linkParagraph('b4', 'https://example.com/relatorio'),
    ], isEmbeddableUrl)

    expect(result.converted).toEqual([])
  })

  it('reaches links nested inside other blocks', () => {
    const result = convertLegacyLinkBlocks([
      {
        children: [linkParagraph('b6', 'https://miro.com/app/board/uXjVOxyz123=/')],
        content: [],
        id: 'b5',
        props: {},
        type: 'bulletListItem',
      },
    ], isEmbeddableUrl)

    expect(result.converted).toHaveLength(1)
    expect(result.blocks[0].children?.[0].type).toBe('embed')
  })
})
