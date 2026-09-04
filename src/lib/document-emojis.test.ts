import { describe, expect, it } from 'vitest'

import {
  allEmojis,
  emojiGroupIds,
  emojiGroups,
  normalizeEmojiQuery,
  randomEmoji,
  searchEmojis,
} from '@/lib/document-emojis'
import { readDocumentIcon } from '@/lib/document-icon'

describe('emojiGroups', () => {
  it('covers every group id exactly once and is never empty', () => {
    expect(emojiGroups.map((group) => group.id)).toEqual([...emojiGroupIds])

    for (const group of emojiGroups) {
      expect(group.emojis.length).toBeGreaterThan(0)
    }
  })

  it('has no repeated emoji across groups', () => {
    const seen = new Set(allEmojis.map((entry) => entry.emoji))

    expect(seen.size).toBe(allEmojis.length)
  })

  it('gives every emoji at least one keyword to search by', () => {
    for (const entry of allEmojis) {
      expect(entry.keywords.length).toBeGreaterThan(0)
    }
  })

  it('offers only emojis the document icon reader accepts as text', () => {
    for (const entry of allEmojis) {
      expect(readDocumentIcon(entry.emoji)).toEqual({
        kind: 'text',
        text: entry.emoji,
      })
    }
  })
})

describe('normalizeEmojiQuery', () => {
  it('drops accents, case and surrounding space', () => {
    expect(normalizeEmojiQuery('  CoraÇÃO ')).toBe('coracao')
    expect(normalizeEmojiQuery('Árvore')).toBe('arvore')
  })
})

describe('searchEmojis', () => {
  it('finds an emoji by a portuguese keyword, accents or not', () => {
    expect(searchEmojis('coracao').map((entry) => entry.emoji)).toContain('❤️')
    expect(searchEmojis('coração').map((entry) => entry.emoji)).toContain('❤️')
  })

  it('finds an emoji by an english keyword', () => {
    expect(searchEmojis('rocket').map((entry) => entry.emoji)).toContain('🚀')
  })

  it('narrows the result as terms are added', () => {
    const one = searchEmojis('folha')
    const two = searchEmojis('folha bordo')

    expect(two.length).toBeLessThan(one.length)
    expect(two.map((entry) => entry.emoji)).toContain('🍁')
  })

  it('finds an emoji pasted into the search field', () => {
    expect(searchEmojis('🚀').map((entry) => entry.emoji)).toContain('🚀')
  })

  it('returns nothing for an empty query', () => {
    expect(searchEmojis('')).toEqual([])
    expect(searchEmojis('   ')).toEqual([])
  })

  it('returns nothing when no keyword matches', () => {
    expect(searchEmojis('zzzzzz')).toEqual([])
  })

  it('never returns more than the limit', () => {
    expect(searchEmojis('a', 5)).toHaveLength(5)
  })
})

describe('randomEmoji', () => {
  it('picks from the catalog', () => {
    const catalog = new Set(allEmojis.map((entry) => entry.emoji))

    expect(catalog.has(randomEmoji(() => 0))).toBe(true)
    expect(catalog.has(randomEmoji(() => 0.5))).toBe(true)
    expect(catalog.has(randomEmoji())).toBe(true)
  })

  it('stays inside the catalog when the source hits its edges', () => {
    expect(randomEmoji(() => 0)).toBe(allEmojis[0]?.emoji)
    expect(randomEmoji(() => 0.999999)).toBe(
      allEmojis[allEmojis.length - 1]?.emoji,
    )
    expect(randomEmoji(() => 1)).toBe(allEmojis[allEmojis.length - 1]?.emoji)
  })
})
