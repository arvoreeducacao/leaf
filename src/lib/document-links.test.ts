import { describe, expect, it } from 'vitest'

import {
  documentIdFromHref,
  documentIdsFromQuery,
  documentIdsInContent,
} from '@/lib/document-links'

describe('documentIdFromHref', () => {
  it('reads the id of a relative document link', () => {
    expect(documentIdFromHref('/doc/DQJ_0aM01VfV')).toBe('DQJ_0aM01VfV')
  })

  it('ignores query string and hash', () => {
    expect(documentIdFromHref('/doc/DQJ_0aM01VfV?tab=1#x')).toBe('DQJ_0aM01VfV')
  })

  it('reads an absolute link of the same origin', () => {
    expect(
      documentIdFromHref(
        'https://leaf.example.com/doc/DQJ_0aM01VfV',
        'https://leaf.example.com',
      ),
    ).toBe('DQJ_0aM01VfV')
  })

  it('refuses an absolute link of another origin', () => {
    expect(
      documentIdFromHref(
        'https://evil.example.com/doc/DQJ_0aM01VfV',
        'https://leaf.example.com',
      ),
    ).toBeNull()
  })

  it('refuses anything that is not a document link', () => {
    expect(documentIdFromHref('/documents')).toBeNull()
    expect(documentIdFromHref('/doc/')).toBeNull()
    expect(documentIdFromHref('https://www.notion.so/abc')).toBeNull()
    expect(documentIdFromHref(null)).toBeNull()
  })
})

describe('documentIdsInContent', () => {
  it('collects the linked documents of a stored page, without repeating', () => {
    const content = JSON.stringify([
      {
        content: [
          { type: 'link', href: '/doc/aaa', content: [] },
          { type: 'link', href: '/doc/bbb', content: [] },
          { type: 'link', href: '/doc/aaa', content: [] },
          { type: 'link', href: 'https://www.notion.so/x', content: [] },
        ],
        type: 'paragraph',
      },
    ])

    expect(documentIdsInContent(content)).toEqual(['aaa', 'bbb'])
  })

  it('gives nothing for empty content', () => {
    expect(documentIdsInContent(null)).toEqual([])
    expect(documentIdsInContent('')).toEqual([])
  })
})

describe('documentIdsFromQuery', () => {
  it('reads a comma separated list and drops what is not an id', () => {
    expect(documentIdsFromQuery('aaa, bbb , ,../etc,ccc')).toEqual([
      'aaa',
      'bbb',
      'ccc',
    ])
  })

  it('gives nothing without a value', () => {
    expect(documentIdsFromQuery(null)).toEqual([])
  })
})
