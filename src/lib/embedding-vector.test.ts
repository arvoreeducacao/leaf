import { describe, expect, it } from 'vitest'

import {
  chunkMinChars,
  chunkOverlapChars,
  chunkTargetChars,
  chunkText,
  decodeVector,
  dotProduct,
  encodeVector,
  maxChunksPerDocument,
  normalizeVector,
} from '@/lib/embedding-vector'

function words(count: number, word: string) {
  return Array.from({ length: count }, () => word).join(' ')
}

describe('chunkText', () => {
  it('returns nothing for text without content', () => {
    expect(chunkText('')).toEqual([])
    expect(chunkText('   \n  \n ')).toEqual([])
  })

  it('keeps a short document in a single chunk', () => {
    expect(chunkText('Uma linha curta.\n\nOutra linha curta.')).toEqual([
      'Uma linha curta.\nOutra linha curta.',
    ])
  })

  it('never returns a chunk longer than the target', () => {
    const chunks = chunkText(words(4_000, 'palavra'))

    expect(chunks.length).toBeGreaterThan(1)

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(chunkTargetChars)
    }
  })

  it('repeats the tail of the previous chunk as overlap', () => {
    const chunks = chunkText(
      Array.from({ length: 40 }, (_, index) => `Parágrafo ${index} ${words(20, 'texto')}.`).join('\n'),
    )

    expect(chunks.length).toBeGreaterThan(1)

    const tail = chunks[0].slice(chunks[0].length - chunkOverlapChars)
    const shared = tail.slice(tail.indexOf(' ') + 1)

    expect(chunks[1].startsWith(shared)).toBe(true)
  })

  it('splits a single oversized paragraph by sentence', () => {
    const sentence = `${words(30, 'frase')}. `
    const chunks = chunkText(sentence.repeat(20))

    expect(chunks.length).toBeGreaterThan(1)

    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(chunkTargetChars)
    }
  })

  it('glues a leftover tail into the previous chunk', () => {
    const chunks = chunkText(`${words(400, 'palavra')}\nfim`)

    expect(chunks[chunks.length - 1].endsWith('fim')).toBe(true)
    expect(chunks[chunks.length - 1].length).toBeGreaterThan(chunkMinChars)
  })

  it('stops at the maximum number of chunks of a document', () => {
    expect(chunkText(words(200_000, 'palavra')).length).toBe(
      maxChunksPerDocument,
    )
  })
})

describe('normalizeVector', () => {
  it('gives the vector length one', () => {
    const vector = normalizeVector([3, 4])

    expect(vector[0]).toBeCloseTo(0.6, 6)
    expect(vector[1]).toBeCloseTo(0.8, 6)
    expect(dotProduct(vector, vector)).toBeCloseTo(1, 6)
  })

  it('keeps a vector of zeros as it is', () => {
    expect([...normalizeVector([0, 0, 0])]).toEqual([0, 0, 0])
  })
})

describe('encodeVector', () => {
  it('survives the round trip through the blob', () => {
    const vector = normalizeVector([0.25, -0.5, 0.75, 1])
    const decoded = decodeVector(encodeVector(vector))

    expect([...decoded]).toEqual([...vector])
  })

  it('writes four bytes per dimension', () => {
    expect(encodeVector(new Float32Array(512)).byteLength).toBe(2_048)
  })

  it('decodes a slice of a bigger buffer without borrowing its neighbours', () => {
    const first = encodeVector(normalizeVector([1, 0]))
    const second = encodeVector(normalizeVector([0, 1]))
    const joined = Buffer.concat([first, second])

    expect([...decodeVector(joined.subarray(0, first.byteLength))]).toEqual([
      1, 0,
    ])
  })
})

describe('dotProduct', () => {
  it('is one for the same normalized vector and zero for an orthogonal one', () => {
    const left = normalizeVector([1, 1, 0])
    const right = normalizeVector([0, 0, 1])

    expect(dotProduct(left, left)).toBeCloseTo(1, 6)
    expect(dotProduct(left, right)).toBeCloseTo(0, 6)
  })
})
