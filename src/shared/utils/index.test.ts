import { describe, expect, it } from 'vitest'

import { cn } from './index'

describe('cn', () => {
  it('mantém o tamanho de fonte do design system ao lado de uma cor', () => {
    expect(cn('text-body-small', 'text-content')).toBe(
      'text-body-small text-content',
    )
  })

  it('mantém o tamanho de fonte ao lado de um alinhamento', () => {
    expect(cn('text-left text-caption text-content-subtle')).toBe(
      'text-left text-caption text-content-subtle',
    )
  })

  it('deixa o último tamanho de fonte ganhar', () => {
    expect(cn('text-body-small', 'text-display-medium')).toBe(
      'text-display-medium',
    )
  })

  it('deixa o último raio ganhar', () => {
    expect(cn('rounded-large', 'rounded-small')).toBe('rounded-small')
  })

  it('deixa o último peso de fonte ganhar', () => {
    expect(cn('font-medium', 'font-heavy')).toBe('font-heavy')
  })

  it('deixa a última elevação ganhar', () => {
    expect(cn('shadow-down-medium', 'shadow-center-large')).toBe(
      'shadow-center-large',
    )
  })
})
