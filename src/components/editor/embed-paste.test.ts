import { describe, expect, it } from 'vitest'

import { acceptsEmbedPaste, embeddablePastedUrl } from './embed-paste'

describe('embeddablePastedUrl', () => {
  it('takes a lone embeddable link', () => {
    expect(
      embeddablePastedUrl('  https://www.figma.com/design/abc123XY/Leaf  '),
    ).toBe('https://www.figma.com/design/abc123XY/Leaf')
  })

  it('ignores prose that happens to carry a link', () => {
    expect(
      embeddablePastedUrl('olha isso https://youtu.be/dQw4w9WgXcQ'),
    ).toBeNull()
  })

  it('ignores a link nobody can frame', () => {
    expect(embeddablePastedUrl('https://example.com')).toBeNull()
    expect(embeddablePastedUrl('')).toBeNull()
    expect(embeddablePastedUrl(null)).toBeNull()
  })
})

describe('acceptsEmbedPaste', () => {
  it('only replaces an empty paragraph', () => {
    expect(acceptsEmbedPaste({ content: [], type: 'paragraph' })).toBe(true)
    expect(
      acceptsEmbedPaste({
        content: [{ text: 'já escrito', type: 'text' }],
        type: 'paragraph',
      }),
    ).toBe(false)
    expect(acceptsEmbedPaste({ content: [], type: 'heading' })).toBe(false)
    expect(acceptsEmbedPaste(null)).toBe(false)
  })
})
