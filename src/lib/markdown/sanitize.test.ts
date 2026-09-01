import { describe, expect, it } from 'vitest'

import { sanitizeBlocks } from '@/lib/markdown/sanitize'

describe('sanitizeBlocks nos blocos que viram âncora clicável', () => {
  it('zera a url de um bloco de arquivo com protocolo javascript', () => {
    const blocks = [
      { type: 'file', props: { name: 'x', url: 'javascript:alert(document.cookie)' } },
    ]

    expect(sanitizeBlocks(blocks)[0].props.url).toBe('')
  })

  it('zera a url de blocos de vídeo e áudio com protocolo perigoso', () => {
    const blocks = [
      { type: 'video', props: { url: 'javascript:alert(1)' } },
      { type: 'audio', props: { url: 'data:text/html,<script>alert(1)</script>' } },
    ]

    const cleaned = sanitizeBlocks(blocks)

    expect(cleaned[0].props.url).toBe('')
    expect(cleaned[1].props.url).toBe('')
  })

  it('preserva urls seguras e assets internos', () => {
    const blocks = [
      { type: 'image', props: { url: 'https://exemplo.com.br/a.png' } },
      { type: 'file', props: { url: '/api/uploads/u/abc.png' } },
    ]

    const cleaned = sanitizeBlocks(blocks)

    expect(cleaned[0].props.url).toBe('https://exemplo.com.br/a.png')
    expect(cleaned[1].props.url).toBe('/api/uploads/u/abc.png')
  })

  it('desce em blocos aninhados', () => {
    const blocks = [
      {
        type: 'paragraph',
        children: [{ type: 'file', props: { url: 'javascript:alert(1)' } }],
      },
    ]

    expect(sanitizeBlocks(blocks)[0].children[0].props.url).toBe('')
  })
})
