import { describe, expect, it } from 'vitest'

import { looksBinary } from '@/lib/markdown/text'

describe('looksBinary', () => {
  it('accepts ordinary markdown', () => {
    expect(looksBinary('# Title\n\nA paragraph with naïve accented characters.')).toBe(false)
  })

  it('rejects text with a null byte', () => {
    expect(looksBinary(`PK${String.fromCharCode(0)}`)).toBe(true)
  })

  it('rejects text full of replacement characters', () => {
    const noise = String.fromCharCode(0xfffd).repeat(40)

    expect(looksBinary(`abc${noise}`)).toBe(true)
  })

  it('tolerates a lone replacement character in a large text', () => {
    const text = `${'a'.repeat(500)}${String.fromCharCode(0xfffd)}`

    expect(looksBinary(text)).toBe(false)
  })
})
