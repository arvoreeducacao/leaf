import { describe, expect, it } from 'vitest'

import { cn } from './index'

describe('cn', () => {
  it('keeps the design system font size next to a color', () => {
    expect(cn('text-body-small', 'text-content')).toBe(
      'text-body-small text-content',
    )
  })

  it('keeps the font size next to an alignment', () => {
    expect(cn('text-left text-caption text-content-subtle')).toBe(
      'text-left text-caption text-content-subtle',
    )
  })

  it('lets the last font size win', () => {
    expect(cn('text-body-small', 'text-display-medium')).toBe(
      'text-display-medium',
    )
  })

  it('lets the last radius win', () => {
    expect(cn('rounded-large', 'rounded-small')).toBe('rounded-small')
  })

  it('lets the last font weight win', () => {
    expect(cn('font-medium', 'font-heavy')).toBe('font-heavy')
  })

  it('lets the last elevation win', () => {
    expect(cn('shadow-down-medium', 'shadow-center-large')).toBe(
      'shadow-center-large',
    )
  })
})
