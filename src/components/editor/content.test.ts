import { describe, expect, it } from 'vitest'

import { parseDocumentContent, readDocumentContent } from './content'

describe('readDocumentContent', () => {
  it('returns an empty paragraph when there is no content', () => {
    expect(readDocumentContent(null)).toEqual({
      status: 'ok',
      blocks: [{ type: 'paragraph' }],
    })
  })

  it('returns an empty paragraph when the stored document is empty', () => {
    expect(readDocumentContent('[]')).toEqual({
      status: 'ok',
      blocks: [{ type: 'paragraph' }],
    })
  })

  it('marks it unreadable when the JSON is corrupted', () => {
    expect(readDocumentContent('{')).toEqual({ status: 'unreadable' })
  })

  it('marks it unreadable when the JSON is not a list of blocks', () => {
    expect(readDocumentContent('{"a":1}')).toEqual({ status: 'unreadable' })
    expect(readDocumentContent('"text"')).toEqual({ status: 'unreadable' })
  })

  it('keeps the stored blocks', () => {
    const blocks = [{ type: 'heading', props: { level: 2 }, content: 'Hello' }]

    expect(readDocumentContent(JSON.stringify(blocks))).toEqual({
      status: 'ok',
      blocks,
    })
  })
})

describe('parseDocumentContent', () => {
  it('returns an empty paragraph when the content is unreadable', () => {
    expect(parseDocumentContent('{')).toEqual([{ type: 'paragraph' }])
  })

  it('keeps the stored blocks', () => {
    const blocks = [{ type: 'heading', props: { level: 2 }, content: 'Hello' }]

    expect(parseDocumentContent(JSON.stringify(blocks))).toEqual(blocks)
  })
})
