import { describe, expect, it } from 'vitest'

import type { NotionBlock } from '@/lib/notion/api'
import type { BlockNode, ConvertContext } from '@/lib/notion/convert'
import { convertNodes } from '@/lib/notion/convert'

function node(block: NotionBlock, children: Array<BlockNode> = []): BlockNode {
  return { block, children }
}

function makeContext(overrides: Partial<ConvertContext> = {}): {
  context: ConvertContext
  unsupported: Array<string>
} {
  const unsupported: Array<string> = []

  return {
    context: {
      assetPath: (url) => `assets/${url.split('/').pop()}`,
      pageRef: (id) => `${id}.md`,
      unsupported: (type) => unsupported.push(type),
      ...overrides,
    },
    unsupported,
  }
}

describe('convertNodes', () => {
  it('keeps bold, underline and colors as styles', () => {
    const { context } = makeContext()
    const blocks = convertNodes(
      [
        node({
          id: 'b1',
          paragraph: {
            rich_text: [
              {
                annotations: { bold: true, color: 'red' },
                plain_text: 'alert',
              },
              {
                annotations: { color: 'yellow_background', underline: true },
                plain_text: ' note',
              },
            ],
          },
          type: 'paragraph',
        }),
      ],
      context,
    )

    const content = blocks[0].content as Array<{
      text: string
      styles: Record<string, unknown>
    }>

    expect(content[0].styles).toEqual({ bold: true, textColor: 'red' })
    expect(content[1].styles).toEqual({
      backgroundColor: 'yellow',
      underline: true,
    })
  })

  it('links page mentions to the imported page', () => {
    const { context } = makeContext()
    const blocks = convertNodes(
      [
        node({
          id: 'b1',
          paragraph: {
            rich_text: [
              {
                mention: { page: { id: 'target' }, type: 'page' },
                plain_text: 'Roadmap',
                type: 'mention',
              },
            ],
          },
          type: 'paragraph',
        }),
      ],
      context,
    )

    const content = blocks[0].content as Array<Record<string, unknown>>

    expect(content[0].type).toBe('link')
    expect(content[0].href).toBe('target.md')
  })

  it('keeps the callout icon and color', () => {
    const { context } = makeContext()
    const blocks = convertNodes(
      [
        node({
          callout: {
            color: 'purple_background',
            icon: { emoji: '💡', type: 'emoji' },
            rich_text: [{ annotations: {}, plain_text: 'tip' }],
          },
          id: 'b1',
          type: 'callout',
        }),
      ],
      context,
    )

    expect(blocks[0].type).toBe('callout')
    expect(blocks[0].props).toEqual({
      backgroundColor: 'purple',
      icon: '💡',
    })
  })

  it('turns column lists into columnList blocks', () => {
    const { context } = makeContext()
    const paragraph = (id: string, text: string) =>
      node({
        id,
        paragraph: { rich_text: [{ annotations: {}, plain_text: text }] },
        type: 'paragraph',
      })
    const blocks = convertNodes(
      [
        node({ column_list: {}, id: 'cl', type: 'column_list' }, [
          node({ column: {}, id: 'c1', type: 'column' }, [
            paragraph('p1', 'left'),
          ]),
          node({ column: {}, id: 'c2', type: 'column' }, [
            paragraph('p2', 'right'),
          ]),
        ]),
      ],
      context,
    )

    expect(blocks[0].type).toBe('columnList')
    expect(blocks[0].children).toHaveLength(2)
    expect(blocks[0].children?.[0].type).toBe('column')
    expect(blocks[0].children?.[0].children?.[0].type).toBe('paragraph')
  })

  it('flattens a single-column list', () => {
    const { context } = makeContext()
    const blocks = convertNodes(
      [
        node({ column_list: {}, id: 'cl', type: 'column_list' }, [
          node({ column: {}, id: 'c1', type: 'column' }, [
            node({
              id: 'p1',
              paragraph: {
                rich_text: [{ annotations: {}, plain_text: 'only' }],
              },
              type: 'paragraph',
            }),
          ]),
        ]),
      ],
      context,
    )

    expect(blocks[0].type).toBe('paragraph')
  })

  it('keeps toggle headings toggleable and nests their children', () => {
    const { context } = makeContext()
    const blocks = convertNodes(
      [
        node(
          {
            heading_2: {
              is_toggleable: true,
              rich_text: [{ annotations: {}, plain_text: 'Details' }],
            },
            id: 'h1',
            type: 'heading_2',
          },
          [
            node({
              id: 'p1',
              paragraph: {
                rich_text: [{ annotations: {}, plain_text: 'hidden' }],
              },
              type: 'paragraph',
            }),
          ],
        ),
      ],
      context,
    )

    expect(blocks[0].type).toBe('heading')
    expect(blocks[0].props).toEqual({ isToggleable: true, level: 2 })
    expect(blocks[0].children?.[0].type).toBe('paragraph')
  })

  it('converts toggles and to-dos', () => {
    const { context } = makeContext()
    const blocks = convertNodes(
      [
        node({
          id: 't1',
          toggle: { rich_text: [{ annotations: {}, plain_text: 'more' }] },
          type: 'toggle',
        }),
        node({
          id: 'td1',
          to_do: {
            checked: true,
            rich_text: [{ annotations: {}, plain_text: 'done' }],
          },
          type: 'to_do',
        }),
      ],
      context,
    )

    expect(blocks[0].type).toBe('toggleListItem')
    expect(blocks[1].type).toBe('checkListItem')
    expect(blocks[1].props?.checked).toBe(true)
  })

  it('counts blocks without an equivalent', () => {
    const { context, unsupported } = makeContext()
    const blocks = convertNodes(
      [
        node({ id: 'u1', table_of_contents: {}, type: 'table_of_contents' }),
        node({ id: 'u2', type: 'unsupported', unsupported: {} }),
      ],
      context,
    )

    expect(blocks).toHaveLength(0)
    expect(unsupported).toEqual(['table_of_contents', 'unsupported'])
  })

  it('keeps equations as latex code blocks', () => {
    const { context } = makeContext()
    const blocks = convertNodes(
      [
        node({
          equation: { expression: 'a^2 + b^2' },
          id: 'e1',
          type: 'equation',
        }),
      ],
      context,
    )

    expect(blocks[0].type).toBe('codeBlock')
    expect(blocks[0].props?.language).toBe('latex')
  })

  it('turns bookmarks into link paragraphs', () => {
    const { context } = makeContext()
    const blocks = convertNodes(
      [
        node({
          bookmark: { caption: [], url: 'https://arvore.com.br' },
          id: 'bm1',
          type: 'bookmark',
        }),
      ],
      context,
    )

    const content = blocks[0].content as Array<Record<string, unknown>>

    expect(blocks[0].type).toBe('paragraph')
    expect(content[0].type).toBe('link')
    expect(content[0].href).toBe('https://arvore.com.br')
  })

  it('turns an embeddable link into an embed block instead of a bare link', () => {
    const { context } = makeContext()
    const blocks = convertNodes(
      [
        node({
          embed: {
            caption: [{ plain_text: 'Fluxo novo', type: 'text' }],
            url: 'https://www.figma.com/design/abc123XY/Leaf',
          },
          id: 'em1',
          type: 'embed',
        }),
      ],
      context,
    )

    expect(blocks[0].type).toBe('embed')
    expect(blocks[0].props?.url).toBe(
      'https://www.figma.com/design/abc123XY/Leaf',
    )
    expect(blocks[0].props?.caption).toBe('Fluxo novo')
  })

  it('keeps the link paragraph when nothing can frame the page', () => {
    const { context } = makeContext()
    const blocks = convertNodes(
      [
        node({
          embed: { caption: [], url: 'https://arvore.com.br/relatorio' },
          id: 'em2',
          type: 'embed',
        }),
      ],
      context,
    )

    expect(blocks[0].type).toBe('paragraph')
  })
})
