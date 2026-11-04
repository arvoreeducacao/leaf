import { describe, expect, it } from 'vitest'

import {
  CREATOR_TOKEN,
  NEXT_CYCLE_TOKEN,
  holdsToken,
  isCycleProperty,
  nextCycleName,
  replaceToken,
  withTemplateOptions,
  withTemplatePeople,
} from './template-tokens'
import { parseOptions, serializeOptions } from './values'

const labels = { creator: 'Quem criar a página', nextCycle: 'Próximo ciclo' }

const cycles = {
  type: 'multiSelect' as const,
  options: serializeOptions([
    { id: 'a', name: '2026-05', color: 'gray' },
    { id: 'b', name: '2026-06', color: 'blue' },
  ]),
}

describe('the next cycle', () => {
  it('is the two-month block after the one today falls in', () => {
    expect(nextCycleName(new Date('2026-09-15T12:00:00Z'))).toBe('2026-06')
    expect(nextCycleName(new Date('2026-03-01T12:00:00Z'))).toBe('2026-03')
  })

  it('turns the year after november and december', () => {
    expect(nextCycleName(new Date('2026-11-04T12:00:00Z'))).toBe('2027-01')
    expect(nextCycleName(new Date('2026-12-31T12:00:00Z'))).toBe('2027-01')
  })

  it('reads the month in Brazil, not in UTC', () => {
    expect(nextCycleName(new Date('2026-11-01T01:00:00Z'))).toBe('2026-06')
  })
})

describe('a cycle property', () => {
  it('is a select whose options all look like a cycle', () => {
    expect(isCycleProperty(cycles)).toBe(true)
  })

  it('is not a select with any other option, or with none', () => {
    expect(
      isCycleProperty({
        type: 'multiSelect',
        options: serializeOptions([
          { id: 'a', name: '2026-05', color: 'gray' },
          { id: 'b', name: 'Leitura', color: 'blue' },
        ]),
      }),
    ).toBe(false)
    expect(isCycleProperty({ type: 'multiSelect', options: null })).toBe(false)
    expect(isCycleProperty({ type: 'text', options: null })).toBe(false)
  })

  it('offers the next cycle first while a template is edited', () => {
    expect(
      parseOptions(withTemplateOptions(cycles, labels).options).map(
        (option) => option.id,
      ),
    ).toEqual([NEXT_CYCLE_TOKEN, 'a', 'b'])
  })
})

describe('template tokens', () => {
  it('offers whoever creates the page as the first person', () => {
    expect(withTemplatePeople([], labels)[0]?.id).toBe(CREATOR_TOKEN)
  })

  it('swaps the token for the real value without repeating it', () => {
    expect(replaceToken([CREATOR_TOKEN, 'ana'], CREATOR_TOKEN, 'ana')).toEqual([
      'ana',
    ])
    expect(replaceToken(NEXT_CYCLE_TOKEN, NEXT_CYCLE_TOKEN, 'b')).toBe('b')
    expect(holdsToken(['x'], CREATOR_TOKEN)).toBe(false)
  })
})
