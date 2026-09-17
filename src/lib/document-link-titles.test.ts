import { describe, expect, it } from 'vitest'

import { retitleDocumentLinks } from '@/lib/document-link-titles'

const origin = 'https://leaf.example.com'

function paragraphWithLink(href: string, text: string) {
  return {
    id: 'block-1',
    type: 'paragraph',
    content: [
      { type: 'link', href, content: [{ type: 'text', text, styles: {} }] },
      { type: 'text', text: ' ', styles: {} },
    ],
  }
}

describe('retitleDocumentLinks', () => {
  it('rewrites the link that still carries the old title', () => {
    const result = retitleDocumentLinks(
      [paragraphWithLink('/doc/abc123', 'Sem título')],
      'abc123',
      'Sem título',
      'Cronograma de envios',
      origin,
    )

    expect(result.changed).toBe(true)
    expect(result.blocks[0]).toMatchObject({
      content: [
        {
          type: 'link',
          href: '/doc/abc123',
          content: [{ type: 'text', text: 'Cronograma de envios' }],
        },
        { type: 'text', text: ' ' },
      ],
    })
  })

  it('leaves alone the link whose text someone wrote by hand', () => {
    const blocks = [paragraphWithLink('/doc/abc123', 'veja o cronograma')]
    const result = retitleDocumentLinks(
      blocks,
      'abc123',
      'Sem título',
      'Cronograma de envios',
      origin,
    )

    expect(result.changed).toBe(false)
    expect(result.blocks[0]).toBe(blocks[0])
  })

  it('leaves alone a link that points at another document', () => {
    const result = retitleDocumentLinks(
      [paragraphWithLink('/doc/other99', 'Sem título')],
      'abc123',
      'Sem título',
      'Cronograma de envios',
      origin,
    )

    expect(result.changed).toBe(false)
  })

  it('recognizes the absolute link of the same installation', () => {
    const result = retitleDocumentLinks(
      [paragraphWithLink(`${origin}/doc/abc123`, 'Sem título')],
      'abc123',
      'Sem título',
      'Cronograma de envios',
      origin,
    )

    expect(result.changed).toBe(true)
  })

  it('keeps the styles the link text already had', () => {
    const result = retitleDocumentLinks(
      [
        {
          id: 'block-1',
          type: 'paragraph',
          content: [
            {
              type: 'link',
              href: '/doc/abc123',
              content: [
                { type: 'text', text: 'Sem título', styles: { bold: true } },
              ],
            },
          ],
        },
      ],
      'abc123',
      'Sem título',
      'Cronograma de envios',
      origin,
    )

    expect(result.blocks[0]).toMatchObject({
      content: [{ content: [{ styles: { bold: true } }] }],
    })
  })

  it('reaches the link nested in a child block', () => {
    const result = retitleDocumentLinks(
      [
        {
          id: 'block-1',
          type: 'bulletListItem',
          content: [{ type: 'text', text: 'Pendências', styles: {} }],
          children: [paragraphWithLink('/doc/abc123', 'Sem título')],
        },
      ],
      'abc123',
      'Sem título',
      'Cronograma de envios',
      origin,
    )

    expect(result.changed).toBe(true)
    expect(
      (result.blocks[0].children as Array<{ content: Array<unknown> }>)[0]
        .content[0],
    ).toMatchObject({
      content: [{ text: 'Cronograma de envios' }],
    })
  })

  it('reaches the link inside a table cell', () => {
    const result = retitleDocumentLinks(
      [
        {
          id: 'block-1',
          type: 'table',
          content: {
            type: 'tableContent',
            rows: [
              {
                cells: [
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'link',
                        href: '/doc/abc123',
                        content: [
                          { type: 'text', text: 'Sem título', styles: {} },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        },
      ],
      'abc123',
      'Sem título',
      'Cronograma de envios',
      origin,
    )

    expect(result.changed).toBe(true)
    expect(JSON.stringify(result.blocks)).toContain('Cronograma de envios')
  })

  it('compares the title ignoring the spaces around it', () => {
    const result = retitleDocumentLinks(
      [paragraphWithLink('/doc/abc123', ' Sem título ')],
      'abc123',
      'Sem título',
      'Cronograma de envios',
      origin,
    )

    expect(result.changed).toBe(true)
  })
})
