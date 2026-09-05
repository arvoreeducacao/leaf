import { describe, expect, it } from 'vitest'

import { documentExcerpt, previewTrail } from './document-preview'

function content(blocks: unknown) {
  return JSON.stringify(blocks)
}

describe('documentExcerpt', () => {
  it('is empty for a document with no text', () => {
    expect(documentExcerpt(null)).toBe('')
    expect(documentExcerpt(content([{ type: 'paragraph' }]))).toBe('')
  })

  it('keeps one line per block and drops the empty ones', () => {
    const blocks = [
      { type: 'heading', content: [{ type: 'text', text: 'Postmortems' }] },
      { type: 'paragraph', content: [] },
      { type: 'paragraph', content: [{ type: 'text', text: 'O que quebrou' }] },
    ]

    expect(documentExcerpt(content(blocks))).toBe('Postmortems\nO que quebrou')
  })

  it('stops at the fourth line', () => {
    const blocks = Array.from({ length: 9 }, (_, index) => ({
      type: 'paragraph',
      content: [{ type: 'text', text: `linha ${index}` }],
    }))

    expect(documentExcerpt(content(blocks)).split('\n')).toHaveLength(4)
  })

  it('truncates a long line with an ellipsis', () => {
    const blocks = [
      { type: 'paragraph', content: [{ type: 'text', text: 'a'.repeat(400) }] },
    ]
    const excerpt = documentExcerpt(content(blocks))

    expect(excerpt).toHaveLength(241)
    expect(excerpt.endsWith('…')).toBe(true)
  })

  it('is empty when the content cannot be parsed', () => {
    expect(documentExcerpt('not json')).toBe('')
  })
})

describe('previewTrail', () => {
  it('is empty at the root', () => {
    expect(previewTrail([])).toBe('')
  })

  it('joins the ancestors with a slash', () => {
    expect(previewTrail(['Árvore', 'Tecnologia'])).toBe('Árvore / Tecnologia')
  })

  it('keeps the closest ancestors when the trail is deep', () => {
    expect(previewTrail(['a', 'b', 'c', 'd', 'e'])).toBe('… / c / d / e')
  })
})
