import type { PartialBlock } from '@blocknote/core'
import { describe, expect, it } from 'vitest'

import {
  absolutizeBlocks,
  contentToHTML,
  contentToMarkdown,
  documentToMarkdownFile,
  fixExportedHTML,
  markdownToContent,
  parseContentBlocks,
} from '@/lib/markdown/convert'
import { titleFromFileName, toFileSlug } from '@/lib/markdown/filename'
import { sanitizeMarkdown, sanitizeUrl } from '@/lib/markdown/sanitize'

const fixture = [
  '# Reading report',
  '',
  '## Class summary',
  '',
  'Paragraph with **bold**, *italic*, `code` and a [link](https://arvore.com.br).',
  '',
  '- First item',
  '  - Nested item',
  '  - Another nested item',
  '- Second item',
  '',
  '1. Step one',
  '2. Step two',
  '',
  '- [ ] Send the invite',
  '- [x] Confirm attendance',
  '',
  '| Student | Books |',
  '| --- | --- |',
  '| Ana | 12 |',
  '| Bruno | 7 |',
  '',
  '```ts',
  'const total = 19',
  '```',
  '',
  '![Book cover](https://example.com/cover.png)',
  '',
  '> Reading is growing.',
  '',
].join('\n')

async function roundTrip(markdown: string) {
  return contentToMarkdown(await markdownToContent(markdown))
}

function propsOf(block: PartialBlock): Record<string, unknown> {
  return (block.props ?? {}) as Record<string, unknown>
}

describe('markdown round-trip', () => {
  it('preserves the whole document except the list marker and the table padding', async () => {
    const result = await roundTrip(fixture)

    expect(result.trim()).toBe(
      [
        '# Reading report',
        '',
        '## Class summary',
        '',
        'Paragraph with **bold**, *italic*, `code` and a [link](https://arvore.com.br).',
        '',
        '* First item',
        '  * Nested item',
        '  * Another nested item',
        '* Second item',
        '',
        '1. Step one',
        '2. Step two',
        '',
        '* [ ] Send the invite',
        '* [x] Confirm attendance',
        '',
        '| Student    | Books      |',
        '| ---------- | ---------- |',
        '| Ana        | 12         |',
        '| Bruno      | 7          |',
        '',
        '```ts',
        'const total = 19',
        '```',
        '',
        '![Book cover](https://example.com/cover.png)',
        '',
        '> Reading is growing.',
      ].join('\n'),
    )
  })

  it('preserves the heading levels', async () => {
    const result = await roundTrip('# One\n\n## Two\n\n### Three\n')

    expect(result.trim()).toBe('# One\n\n## Two\n\n### Three')
  })

  it('preserves the list nesting', async () => {
    const result = await roundTrip('- parent\n  - child\n    - grandchild\n')

    expect(result.trim()).toBe('* parent\n  * child\n    * grandchild')
  })

  it('preserves the state of each checklist item', async () => {
    const content = await markdownToContent('- [x] done\n- [ ] pending\n')
    const blocks = parseContentBlocks(content)

    expect(blocks.map((block) => block.type)).toEqual([
      'checkListItem',
      'checkListItem',
    ])
    expect(blocks.map((block) => propsOf(block).checked)).toEqual([true, false])
  })

  it('preserves the code fence language', async () => {
    const content = await markdownToContent('```python\nprint(1)\n```\n')
    const blocks = parseContentBlocks(content)

    expect(blocks[0].type).toBe('codeBlock')
    expect(propsOf(blocks[0]).language).toBe('python')
  })

  it('preserves the alt text and the url of the image', async () => {
    const content = await markdownToContent(
      '![Cover](https://example.com/a.png)\n',
    )
    const blocks = parseContentBlocks(content)

    expect(blocks[0].type).toBe('image')
    expect(propsOf(blocks[0]).name).toBe('Cover')
    expect(propsOf(blocks[0]).url).toBe('https://example.com/a.png')
  })

  it('preserves bold, italic and strikethrough', async () => {
    const result = await roundTrip('**a** *b* ~~c~~\n')

    expect(result.trim()).toBe('**a** *b* ~~c~~')
  })

  it('preserves the table as a table block', async () => {
    const content = await markdownToContent(
      '| a | b |\n| --- | --- |\n| 1 | 2 |\n',
    )
    const blocks = parseContentBlocks(content)

    expect(blocks[0].type).toBe('table')
  })
})

describe('accepted round-trip losses', () => {
  it('swaps the list marker from - to *', async () => {
    expect((await roundTrip('- item\n')).trim()).toBe('* item')
  })

  it('loses the column alignment of the table', async () => {
    const result = await roundTrip('| a | b |\n| :--- | ---: |\n| 1 | 2 |\n')

    expect(result).toContain('| ---------- | ---------- |')
    expect(result).not.toContain(':---')
  })

  it('downgrades a raw HTML block to a plain paragraph', async () => {
    const result = await roundTrip('<div class="callout">Notice</div>\n')

    expect(result.trim()).toBe('Notice')
  })

  it('turns a setext heading into a hash heading', async () => {
    const result = await roundTrip('Title\n======\n')

    expect(result.trim()).toBe('# Title')
  })

  it('keeps the footnote as plain text only', async () => {
    const content = await markdownToContent('text[^1]\n\n[^1]: note\n')
    const blocks = parseContentBlocks(content)

    expect(blocks.map((block) => block.type)).toEqual(['paragraph', 'paragraph'])
  })
})

describe('import sanitization', () => {
  it('strips the script tag from the markdown', () => {
    const result = sanitizeMarkdown('before\n\n<script>alert(1)</script>\n\nafter')

    expect(result).not.toContain('script')
    expect(result).toContain('before')
    expect(result).toContain('after')
  })

  it('strips iframe, style and object', () => {
    const result = sanitizeMarkdown(
      '<iframe src="https://evil.com"></iframe><style>a{}</style><object data="x"></object>',
    )

    expect(result.trim()).toBe('')
  })

  it('strips inline event handlers', () => {
    const result = sanitizeMarkdown('<span onmouseover="alert(1)">hi</span>')

    expect(result).not.toContain('onmouseover')
  })

  it('preserves HTML inside a code fence', () => {
    const source = '```html\n<script>alert(1)</script>\n```\n'

    expect(sanitizeMarkdown(source)).toBe(source)
  })

  it('preserves HTML inside a code span', () => {
    const source = 'use `<script>` for that'

    expect(sanitizeMarkdown(source)).toBe(source)
  })

  it('blanks an image url with the javascript protocol', async () => {
    const content = await markdownToContent('![x](javascript:alert(1))\n')
    const blocks = parseContentBlocks(content)

    expect(propsOf(blocks[0]).url).toBe('')
  })

  it('does not produce a link with the javascript protocol', async () => {
    const content = await markdownToContent('[click](javascript:alert(1))\n')

    expect(content).not.toContain('javascript:')
  })

  it('leaves no javascript in the exported HTML', async () => {
    const content = await markdownToContent(
      '![x](javascript:alert(1))\n\n<img src=y onerror="alert(1)">\n',
    )
    const html = await contentToHTML(content, 'Document')

    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('onerror')
  })

  it('escapes the title in the exported HTML', async () => {
    const html = await contentToHTML(null, '<script>alert(1)</script>')

    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('accepts only http, https and mailto', () => {
    expect(sanitizeUrl('https://arvore.com.br')).toBe('https://arvore.com.br')
    expect(sanitizeUrl('http://arvore.com.br')).toBe('http://arvore.com.br')
    expect(sanitizeUrl('mailto:hi@arvore.com.br')).toBe('mailto:hi@arvore.com.br')
    expect(sanitizeUrl('/api/uploads/u/1.png')).toBe('/api/uploads/u/1.png')
    expect(sanitizeUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeUrl('JaVaScRiPt:alert(1)')).toBe('')
    expect(sanitizeUrl('vbscript:msgbox(1)')).toBe('')
    expect(sanitizeUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe('')
  })
})

describe('callout block', () => {
  const callout = JSON.stringify([
    {
      type: 'callout',
      content: [{ type: 'text', text: 'Read carefully', styles: {} }],
    },
  ])

  it('keeps the callout block after going through the parser', () => {
    const blocks = parseContentBlocks(callout)

    expect(blocks[0].type).toBe('callout')
  })

  it('degrades the callout into a quote in the exported markdown', async () => {
    const result = await contentToMarkdown(callout)

    expect(result.trim()).toBe('> Read carefully')
  })

  it('degrades the callout into a blockquote in the exported HTML', async () => {
    const html = await contentToHTML(callout, 'Document')

    expect(html).toContain('<blockquote>')
    expect(html).toContain('Read carefully')
  })
})

describe('empty content', () => {
  it('returns empty markdown when there is no content', async () => {
    expect(await contentToMarkdown(null)).toBe('')
    expect(await contentToMarkdown('')).toBe('')
    expect(await contentToMarkdown('not json')).toBe('')
  })
})

describe('file name', () => {
  it('uses the file name without the extension as the title', () => {
    expect(titleFromFileName('Lesson plan.md', 'Untitled')).toBe('Lesson plan')
    expect(titleFromFileName('notes.markdown', 'Untitled')).toBe('notes')
    expect(titleFromFileName('.md', 'Untitled')).toBe('Untitled')
  })

  it('builds a slug without accent or space', () => {
    expect(toFileSlug('Café at Ávila')).toBe('cafe-at-avila')
    expect(toFileSlug('   ')).toBe('document')
  })
})

describe('export with an internal image', () => {
  const content = JSON.stringify([
    {
      type: 'image',
      props: { url: '/api/uploads/u/abc.png', caption: '', previewWidth: 400 },
    },
    {
      type: 'paragraph',
      content: [
        {
          type: 'link',
          href: '/doc/xyz',
          content: [{ type: 'text', text: 'another page', styles: {} }],
        },
        {
          type: 'link',
          href: 'https://arvore.com.br',
          content: [{ type: 'text', text: 'external', styles: {} }],
        },
      ],
    },
  ])

  it('rewrites an internal url as absolute in the markdown', async () => {
    const markdown = await contentToMarkdown(content, 'http://localhost:3000')

    expect(markdown).toContain('http://localhost:3000/api/uploads/u/abc.png')
    expect(markdown).toContain('http://localhost:3000/doc/xyz')
    expect(markdown).toContain('https://arvore.com.br')
  })

  it('keeps the url relative when there is no origin', async () => {
    const markdown = await contentToMarkdown(content)

    expect(markdown).toContain('/api/uploads/u/abc.png')
    expect(markdown).not.toContain('http://localhost:3000')
  })

  it('does not duplicate the origin on an absolute url', async () => {
    const html = await contentToHTML(content, 'Doc', 'http://localhost:3000')

    expect(html).not.toContain('http://localhost:3000https://')
  })
})

describe('exported html', () => {
  it('fixes the classname attribute from BlockNote', () => {
    expect(fixExportedHTML('<a classname="bn-link" href="#">x</a>')).toBe(
      '<a class="bn-link" href="#">x</a>',
    )
  })

  it('does not emit classname on the html of a link', async () => {
    const content = await markdownToContent(
      'See the [guide](https://arvore.com.br).',
    )
    const html = await contentToHTML(content, 'Doc')

    expect(html).not.toContain('classname=')
    expect(html).toContain('href="https://arvore.com.br"')
  })
})

describe('absolutizeBlocks', () => {
  it('changes nothing when the origin is empty', () => {
    const blocks = [{ type: 'image', props: { url: '/a.png' } }]

    expect(absolutizeBlocks(blocks, '')).toBe(blocks)
  })

  it('ignores a protocol-relative url', () => {
    const result = absolutizeBlocks(
      [{ type: 'image', props: { url: '//cdn.example.com/a.png' } }],
      'http://localhost:3000',
    ) as Array<{ props: { url: string } }>

    expect(result[0].props.url).toBe('//cdn.example.com/a.png')
  })
})

describe('title in the exported file', () => {
  it('does not repeat the title when the content already starts with the same h1', async () => {
    const content = await markdownToContent('# Lesson plan\n\nBody text.')
    const blocks = parseContentBlocks(content)
    const body = await contentToMarkdown(content)

    const file = documentToMarkdownFile('Lesson plan', body, blocks)

    expect(file.match(/# Lesson plan/g)).toHaveLength(1)

    const html = await contentToHTML(content, 'Lesson plan')

    expect(html.match(/Lesson plan<\/h1>/g)).toHaveLength(1)
  })

  it('prefixes the title when the content starts with something else', async () => {
    const content = await markdownToContent('Just a paragraph.')
    const blocks = parseContentBlocks(content)
    const body = await contentToMarkdown(content)

    expect(documentToMarkdownFile('Lesson plan', body, blocks)).toContain(
      '# Lesson plan',
    )
  })
})
