import { describe, expect, it } from 'vitest'

import {
  type SelectOption,
  coerceDate,
  linkHrefFor,
  colorForIndex,
  emptyValueFor,
  formatNumber,
  groupOf,
  isEmptyValue,
  normalizeValue,
  parseOptions,
  parseValues,
  serializeOptions,
  serializeValues,
  sortByStatusGroup,
  valueOf,
  valueToText,
} from './values'

const options: Array<SelectOption> = [
  { id: 'op1', name: 'To do', color: 'gray' },
  { id: 'op2', name: 'Done', color: 'success' },
]

describe('property values', () => {
  it('turns text into a number accepting decimal comma and thousands separator', () => {
    expect(normalizeValue('number', '1.234,56')).toBe(1234.56)
    expect(normalizeValue('number', '1,234.56')).toBe(1234.56)
    expect(normalizeValue('number', 'R$ 42')).toBe(42)
    expect(normalizeValue('number', 'not a number')).toBeNull()
  })

  it('normalizes the date to ISO from the formats Notion exports', () => {
    expect(coerceDate('2026-03-04')).toBe('2026-03-04')
    expect(coerceDate('04/03/2026')).toBe('2026-03-04')
    expect(coerceDate('March 4, 2026')).toBe('2026-03-04')
    expect(coerceDate('nothing')).toBeNull()
  })

  it('reads the checkbox in the shapes that show up in a spreadsheet', () => {
    expect(normalizeValue('checkbox', 'Yes')).toBe(true)
    expect(normalizeValue('checkbox', 'sim')).toBe(true)
    expect(normalizeValue('checkbox', 'No')).toBe(false)
    expect(normalizeValue('checkbox', '')).toBe(false)
  })

  it('blanks a url with a dangerous protocol and keeps the safe one', () => {
    expect(normalizeValue('url', 'javascript:alert(1)')).toBe('')
    expect(normalizeValue('url', 'JaVaScRiPt:alert(1)')).toBe('')
    expect(normalizeValue('url', 'data:text/html;base64,PHNjcmlwdD4=')).toBe('')
    expect(normalizeValue('url', '  java\u0000script:alert(1)  ')).toBe('')
    expect(normalizeValue('url', 'https://example.com')).toBe(
      'https://example.com',
    )
    expect(normalizeValue('url', 'mailto:hi@example.com')).toBe(
      'mailto:hi@example.com',
    )
    expect(normalizeValue('url', '/doc/abc')).toBe('/doc/abc')
  })

  it('only returns an href for a link the browser can open safely', () => {
    expect(linkHrefFor('https://example.com')).toBe('https://example.com')
    expect(linkHrefFor('/doc/abc')).toBe('/doc/abc')
    expect(linkHrefFor('javascript:alert(1)')).toBeNull()
    expect(linkHrefFor('data:text/html,<script>')).toBeNull()
    expect(linkHrefFor('')).toBeNull()
    expect(linkHrefFor(null)).toBeNull()
    expect(linkHrefFor(42)).toBeNull()
  })

  it('drops an option that no longer exists on the property', () => {
    expect(normalizeValue('select', 'op1', options)).toBe('op1')
    expect(normalizeValue('select', 'gone', options)).toBeNull()
    expect(normalizeValue('multiSelect', ['op2', 'gone'], options)).toEqual([
      'op2',
    ])
  })

  it('reduces a multi select to one option when the type becomes select', () => {
    expect(normalizeValue('select', ['op2', 'op1'], options)).toBe('op2')
  })

  it('returns the empty value of each type when the row was never filled in', () => {
    expect(emptyValueFor('checkbox')).toBe(false)
    expect(emptyValueFor('multiSelect')).toEqual([])
    expect(emptyValueFor('text')).toBe('')
    expect(emptyValueFor('number')).toBeNull()

    expect(valueOf({}, { id: 'p1', type: 'text' })).toBe('')
    expect(valueOf({ p1: 7 }, { id: 'p1', type: 'number' })).toBe(7)
  })

  it('recognizes an empty value per type', () => {
    expect(isEmptyValue('')).toBe(true)
    expect(isEmptyValue('  ')).toBe(true)
    expect(isEmptyValue([])).toBe(true)
    expect(isEmptyValue(false)).toBe(true)
    expect(isEmptyValue(0)).toBe(false)
    expect(isEmptyValue('a')).toBe(false)
  })

  it('survives options and values corrupted in the database', () => {
    expect(parseOptions('not json')).toEqual([])
    expect(parseOptions('{"a":1}')).toEqual([])
    expect(parseOptions('[{"id":"x"}]')).toEqual([])
    expect(parseValues('[1,2]')).toEqual({})
    expect(parseValues(null)).toEqual({})
  })

  it('round-trips options and values', () => {
    expect(parseOptions(serializeOptions(options))).toEqual(options)
    expect(parseValues(serializeValues({ p1: 'hi', p2: null }))).toEqual({
      p1: 'hi',
      p2: null,
    })
  })

  it('writes the text of each type for the export', () => {
    expect(valueToText('op1', 'select', options)).toBe('To do')
    expect(valueToText(['op1', 'op2'], 'multiSelect', options)).toBe(
      'To do, Done',
    )
    expect(valueToText(true, 'checkbox', [])).toBe('✓')
    expect(valueToText(false, 'checkbox', [])).toBe('')
    expect(valueToText('2026-03-04', 'date', [], 'en-US')).toContain('2026')
    expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5')
  })

  it('rotates the option colors without running past the palette', () => {
    expect(colorForIndex(0)).toBe(colorForIndex(9))
    expect(colorForIndex(100)).toBeTruthy()
  })
})

describe('person', () => {
  const roster = [
    { id: 'u1', name: 'Rafael', color: 'gray' as const },
    { id: 'u2', name: 'Raposo', color: 'blue' as const },
  ]

  it('starts empty', () => {
    expect(emptyValueFor('person')).toEqual([])
  })

  it('holds several ids', () => {
    expect(normalizeValue('person', ['u1', 'u2'], roster)).toEqual(['u1', 'u2'])
  })

  it('drops whoever is not in the roster when the roster was given', () => {
    expect(normalizeValue('person', ['u1', 'stranger'], roster)).toEqual(['u1'])
  })

  it('lets it through when there is no roster, because the server is the one that validates', () => {
    expect(normalizeValue('person', ['u1', 'u9'])).toEqual(['u1', 'u9'])
  })

  it('writes the names separated by a comma', () => {
    expect(valueToText(['u1', 'u2'], 'person', roster)).toBe('Rafael, Raposo')
  })

  it('counts as empty when nobody is in it', () => {
    expect(isEmptyValue(normalizeValue('person', [], roster))).toBe(true)
  })
})

describe('status', () => {
  const options = [
    { id: 'p', name: 'Pending', color: 'gray' as const, group: 'todo' as const },
    { id: 'f', name: 'Done', color: 'success' as const, group: 'done' as const },
    { id: 'a', name: 'Running', color: 'blue' as const, group: 'doing' as const },
  ]

  it('holds a single value, like the select', () => {
    expect(normalizeValue('status', ['f', 'p'], options)).toBe('f')
  })

  it('survives the round trip through json, group included', () => {
    expect(parseOptions(serializeOptions(options))).toEqual(options)
  })

  it('treats an option without a group as todo', () => {
    expect(groupOf({ id: 'x', name: 'Old', color: 'gray' })).toBe('todo')
  })

  it('rejects a group that does not exist', () => {
    expect(
      parseOptions(
        JSON.stringify([{ id: 'x', name: 'X', color: 'gray', group: 'oops' }]),
      ),
    ).toEqual([])
  })

  it('sorts todo, doing and done', () => {
    expect(sortByStatusGroup(options).map((option) => option.id)).toEqual([
      'p',
      'a',
      'f',
    ])
  })
})
