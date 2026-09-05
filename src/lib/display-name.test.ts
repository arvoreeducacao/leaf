import { describe, expect, it } from 'vitest'

import { MAX_DISPLAY_NAME_LENGTH, normalizeDisplayName } from '@/lib/display-name'

describe('normalizeDisplayName', () => {
  it('trims the edges', () => {
    expect(normalizeDisplayName('  Ana Ribeiro  ')).toBe('Ana Ribeiro')
  })

  it('collapses inner whitespace', () => {
    expect(normalizeDisplayName('Ana   Maria\tRibeiro')).toBe(
      'Ana Maria Ribeiro',
    )
  })

  it('refuses a name made only of spaces', () => {
    expect(normalizeDisplayName('   ')).toBeNull()
  })

  it('cuts a name that is too long', () => {
    expect(normalizeDisplayName('a'.repeat(200))).toHaveLength(
      MAX_DISPLAY_NAME_LENGTH,
    )
  })
})
