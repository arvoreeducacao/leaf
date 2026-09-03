import { describe, expect, it } from 'vitest'

import {
  cssQuoted,
  documentLinkIconRules,
} from '@/components/editor/doc-link-icons'

describe('cssQuoted', () => {
  it('closes the quotes and escapes what would break out of them', () => {
    expect(cssQuoted('🕐')).toBe('"🕐"')
    expect(cssQuoted('a"b')).toBe('"a\\"b"')
    expect(cssQuoted('a\\b')).toBe('"a\\\\b"')
    expect(cssQuoted('a\nb')).toBe('"a b"')
  })
})

describe('documentLinkIconRules', () => {
  it('writes the emoji of the target page before the link', () => {
    const css = documentLinkIconRules([
      { id: 'aaa', icon: '🕐', kind: 'page' },
    ])

    expect(css).toContain('a[href$="/doc/aaa"]::before')
    expect(css).toContain('content:"🕐"')
  })

  it('writes an image icon as a background, brightened in dark mode when it comes from notion', () => {
    const css = documentLinkIconRules([
      {
        id: 'bbb',
        icon: 'https://www.notion.so/icons/book_gray.svg',
        kind: 'page',
      },
    ])

    expect(css).toContain(
      'background-image:url("https://www.notion.so/icons/book_gray.svg")',
    )
    expect(css).toContain('.dark .leaf-editor a[href$="/doc/bbb"]::before')
  })

  it('falls back to the page glyph when the target has no icon', () => {
    const css = documentLinkIconRules([{ id: 'ccc', icon: null, kind: 'page' }])

    expect(css).toContain('mask-image:url("data:image/svg+xml,')
    expect(css).toContain('background-color:currentColor')
  })

  it('uses the table glyph for a database', () => {
    const page = documentLinkIconRules([
      { id: 'ddd', icon: null, kind: 'page' },
    ])
    const database = documentLinkIconRules([
      { id: 'ddd', icon: null, kind: 'database' },
    ])

    expect(database).not.toBe(page)
  })

  it('does not double the icon inside an embedded database header', () => {
    const css = documentLinkIconRules([
      { id: 'eee', icon: '🕐', kind: 'page' },
    ])

    expect(css).toContain(
      '.leaf-editor .leaf-database-block a[href]::before{content:none;}',
    )
  })

  it('refuses an id that would break out of the selector', () => {
    expect(
      documentLinkIconRules([
        { id: '"] , body {display:none} a[x="', icon: '🕐', kind: 'page' },
      ]),
    ).toBe('')
  })
})
