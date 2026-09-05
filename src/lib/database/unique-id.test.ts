import { describe, expect, it } from 'vitest'

import {
  formatUniqueId,
  normalizeUniqueIdPrefix,
  parseUniqueIdConfig,
  planUniqueIds,
  prefixOfText,
  serializeUniqueIdConfig,
  toUniqueIdNumber,
} from './unique-id'

describe('unique id config', () => {
  it('falls back to the first number when there is nothing stored', () => {
    expect(parseUniqueIdConfig(null)).toEqual({ prefix: '', next: 1 })
    expect(parseUniqueIdConfig('not json')).toEqual({ prefix: '', next: 1 })
    expect(parseUniqueIdConfig('[]')).toEqual({ prefix: '', next: 1 })
  })

  it('keeps the stored prefix and counter across a round trip', () => {
    const raw = serializeUniqueIdConfig({ prefix: 'PROP', next: 186 })

    expect(parseUniqueIdConfig(raw)).toEqual({ prefix: 'PROP', next: 186 })
  })

  it('refuses a prefix that would not read as one', () => {
    expect(normalizeUniqueIdPrefix('PROP')).toBe('PROP')
    expect(normalizeUniqueIdPrefix('  task ')).toBe('task')
    expect(normalizeUniqueIdPrefix('12')).toBe('')
    expect(normalizeUniqueIdPrefix('a b')).toBe('')
    expect(normalizeUniqueIdPrefix('a-b')).toBe('')
    expect(normalizeUniqueIdPrefix(42)).toBe('')
  })
})

describe('unique id values', () => {
  it('reads the number out of what Notion left as text', () => {
    expect(toUniqueIdNumber('185')).toBe(185)
    expect(toUniqueIdNumber('PROP-185')).toBe(185)
    expect(toUniqueIdNumber(' PROP - 185 ')).toBe(185)
    expect(toUniqueIdNumber(185)).toBe(185)
    expect(toUniqueIdNumber('')).toBeNull()
    expect(toUniqueIdNumber('sem número')).toBeNull()
    expect(toUniqueIdNumber(0)).toBeNull()
  })

  it('reads the prefix only when the text carries one', () => {
    expect(prefixOfText('PROP-185')).toBe('PROP')
    expect(prefixOfText('185')).toBeNull()
    expect(prefixOfText('nada')).toBeNull()
  })

  it('shows the number with the prefix in front when there is one', () => {
    expect(formatUniqueId(185, 'PROP')).toBe('PROP-185')
    expect(formatUniqueId(185, '')).toBe('185')
    expect(formatUniqueId(null, 'PROP')).toBe('')
  })
})

describe('planning the numbers of a column', () => {
  it('numbers a database that has none from one up', () => {
    const plan = planUniqueIds([
      { id: 'a', value: null },
      { id: 'b', value: null },
      { id: 'c', value: null },
    ])

    expect(plan.assignments).toEqual([
      { rowId: 'a', number: 1 },
      { rowId: 'b', number: 2 },
      { rowId: 'c', number: 3 },
    ])
    expect(plan.next).toBe(4)
    expect(plan.prefix).toBe('')
  })

  it('keeps the numbers that came from Notion and adopts the prefix', () => {
    const plan = planUniqueIds([
      { id: 'a', value: 'PROP-185' },
      { id: 'b', value: 'PROP-186' },
      { id: 'c', value: '' },
    ])

    expect(plan.assignments).toEqual([
      { rowId: 'a', number: 185 },
      { rowId: 'b', number: 186 },
      { rowId: 'c', number: 187 },
    ])
    expect(plan.next).toBe(188)
    expect(plan.prefix).toBe('PROP')
  })

  it('leaves the prefix empty when the rows disagree about it', () => {
    const plan = planUniqueIds([
      { id: 'a', value: 'PROP-1' },
      { id: 'b', value: 'TASK-2' },
    ])

    expect(plan.prefix).toBe('')
  })

  it('gives a fresh number to the second row that repeats one', () => {
    const plan = planUniqueIds([
      { id: 'a', value: '7' },
      { id: 'b', value: '7' },
    ])

    expect(plan.assignments).toEqual([
      { rowId: 'a', number: 7 },
      { rowId: 'b', number: 8 },
    ])
    expect(plan.next).toBe(9)
  })

  it('never hands out a number that a hole in the sequence left behind', () => {
    const plan = planUniqueIds([
      { id: 'a', value: '3' },
      { id: 'b', value: null },
    ])

    expect(plan.assignments).toEqual([
      { rowId: 'a', number: 3 },
      { rowId: 'b', number: 4 },
    ])
  })
})
