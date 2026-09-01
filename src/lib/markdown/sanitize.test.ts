import { describe, expect, it } from 'vitest'

import { sanitizeBlocks } from '@/lib/markdown/sanitize'

describe('sanitizeBlocks on the blocks that become a clickable anchor', () => {
  it('blanks the url of a file block with the javascript protocol', () => {
    const blocks = [
      { type: 'file', props: { name: 'x', url: 'javascript:alert(document.cookie)' } },
    ]

    expect(sanitizeBlocks(blocks)[0].props.url).toBe('')
  })

  it('blanks the url of video and audio blocks with a dangerous protocol', () => {
    const blocks = [
      { type: 'video', props: { url: 'javascript:alert(1)' } },
      { type: 'audio', props: { url: 'data:text/html,<script>alert(1)</script>' } },
    ]

    const cleaned = sanitizeBlocks(blocks)

    expect(cleaned[0].props.url).toBe('')
    expect(cleaned[1].props.url).toBe('')
  })

  it('preserves safe urls and internal assets', () => {
    const blocks = [
      { type: 'image', props: { url: 'https://example.com/a.png' } },
      { type: 'file', props: { url: '/api/uploads/u/abc.png' } },
    ]

    const cleaned = sanitizeBlocks(blocks)

    expect(cleaned[0].props.url).toBe('https://example.com/a.png')
    expect(cleaned[1].props.url).toBe('/api/uploads/u/abc.png')
  })

  it('walks into nested blocks', () => {
    const blocks = [
      {
        type: 'paragraph',
        children: [{ type: 'file', props: { url: 'javascript:alert(1)' } }],
      },
    ]

    expect(sanitizeBlocks(blocks)[0].children[0].props.url).toBe('')
  })
})
