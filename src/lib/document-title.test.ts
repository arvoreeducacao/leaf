import { describe, expect, it } from 'vitest'

import { normalizeTitle } from '@/lib/document-title'

describe('normalizeTitle', () => {
  it('drops the accents so a search without them still matches', () => {
    expect(normalizeTitle('Organização')).toBe('organizacao')
  })

  it('lowercases and trims', () => {
    expect(normalizeTitle('  Plano DE Rollout  ')).toBe('plano de rollout')
  })

  it('leaves a plain title untouched', () => {
    expect(normalizeTitle('roteiro de teste')).toBe('roteiro de teste')
  })
})
