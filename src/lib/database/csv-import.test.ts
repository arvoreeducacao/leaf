import { describe, expect, it } from 'vitest'

import { inferColumnType, inferDatabase } from './csv-import'

describe('csv column type inference', () => {
  it('reads the Notion checkbox in Portuguese and in English', () => {
    expect(inferColumnType(['Yes', 'No', 'Yes'])).toBe('checkbox')
    expect(inferColumnType(['Sim', 'Não'])).toBe('checkbox')
  })

  it('reads a number before trying a date', () => {
    expect(inferColumnType(['12', '7', '3'])).toBe('number')
    expect(inferColumnType(['5', '6'])).toBe('number')
  })

  it('reads a date only when the value has a digit', () => {
    expect(inferColumnType(['2026-03-04', '10/02/2026'])).toBe('date')
    expect(inferColumnType(['May', 'June'])).not.toBe('date')
  })

  it('reads a link', () => {
    expect(
      inferColumnType(['https://arvore.com.br', 'http://leaf.arvore.com.br']),
    ).toBe('url')
  })

  it('reads a multi select when the labels are short and repeat', () => {
    expect(
      inferColumnType([
        'Reading, Writing',
        'Reading',
        'Writing, Fluency',
        'Reading, Fluency',
      ]),
    ).toBe('multiSelect')
  })

  it('does not mistake text with a comma for a multi select', () => {
    expect(
      inferColumnType([
        'Avid reader, likes biographies',
        'Prefers comics',
      ]),
    ).toBe('text')
  })

  it('reads a select when the values repeat', () => {
    expect(
      inferColumnType([
        'To do',
        'Done',
        'To do',
        'In progress',
        'Done',
        'To do',
      ]),
    ).toBe('select')
  })

  it('does not turn a column of unique names into a select', () => {
    expect(
      inferColumnType(['Ana', 'Bruno', 'Carla', 'Davi', 'Eva', 'Fábio']),
    ).toBe('text')
  })

  it('falls back to text when the column is empty', () => {
    expect(inferColumnType(['', '  '])).toBe('text')
  })
})

describe('turning the csv database into a database', () => {
  const table = [
    ['Name', 'Books', 'Status', 'Topics', 'Read'],
    ['Ana', '12', 'Done', 'Reading, Writing', 'Yes'],
    ['Bruno', '7', 'To do', 'Reading', 'No'],
    ['Carla', '', 'Done', '', 'Yes'],
  ]

  it('uses the first column as the row title', () => {
    const inferred = inferDatabase(table, 'Column')

    expect(inferred?.rows.map((row) => row.title)).toEqual([
      'Ana',
      'Bruno',
      'Carla',
    ])
  })

  it('creates one property per column starting from the second', () => {
    const inferred = inferDatabase(table, 'Column')

    expect(
      inferred?.properties.map((property) => [property.name, property.type]),
    ).toEqual([
      ['Books', 'number'],
      ['Status', 'select'],
      ['Topics', 'multiSelect'],
      ['Read', 'checkbox'],
    ])
  })

  it('creates the options in the order they show up', () => {
    const inferred = inferDatabase(table, 'Column')
    const status = inferred?.properties[1]
    const topics = inferred?.properties[2]

    expect(status?.options.map((option) => option.name)).toEqual([
      'Done',
      'To do',
    ])
    expect(topics?.options.map((option) => option.name)).toEqual([
      'Reading',
      'Writing',
    ])
  })

  it('turns each cell into the value of the column type', () => {
    const inferred = inferDatabase(table, 'Column')
    const topics = inferred?.properties[2]
    const ana = inferred?.rows[0]

    expect(ana?.values[0]).toBe(12)
    expect(ana?.values[3]).toBe(true)
    expect(ana?.values[2]).toEqual(topics?.options.map((option) => option.id))
  })

  it('leaves the empty cell without a value instead of inventing one', () => {
    const inferred = inferDatabase(table, 'Column')

    expect(inferred?.rows[2].values[0]).toBeUndefined()
    expect(inferred?.rows[2].values[2]).toBeUndefined()
  })

  it('names a column without a header', () => {
    const inferred = inferDatabase(
      [
        ['Name', ''],
        ['Ana', 'x'],
      ],
      'Column',
    )

    expect(inferred?.properties[0].name).toBe('Column 1')
  })

  it('returns null when there is no header', () => {
    expect(inferDatabase([], 'Column')).toBeNull()
  })
})

describe('person column coming from Notion', () => {
  const people = [
    { id: 'u1', name: 'Rafael Andrade', email: 'rafael.andrade@arvore.com.br' },
    { id: 'u2', name: 'Ricardo raposo', email: 'ricardo.raposo@arvore.com.br' },
    { id: 'u3', name: 'Mateus', email: 'mateus.coutinho@arvore.com.br' },
  ]

  const table = [
    ['Block', 'Owner'],
    ['Catalog', 'Rafael'],
    ['Search', 'Raposo,Coutinho'],
    ['Report', 'Carlinhos'],
  ]

  it('becomes a person when the text matches people from the organization', () => {
    const inferred = inferDatabase(table, 'Column', people)

    expect(inferred?.properties[0].type).toBe('person')
  })

  it('keeps the id of whoever matched and invents nobody who did not', () => {
    const inferred = inferDatabase(table, 'Column', people)

    expect(inferred?.rows[0].values[0]).toEqual(['u1'])
    expect(inferred?.rows[1].values[0]).toEqual(['u2', 'u3'])
    expect(inferred?.rows[2].values[0]).toEqual([])
  })

  it('lists what was left without an owner for someone to resolve', () => {
    expect(inferDatabase(table, 'Column', people)?.unresolvedPeople).toEqual([
      'Carlinhos',
    ])
  })

  it('never becomes a person when there is no organization', () => {
    expect(inferDatabase(table, 'Column')?.properties[0].type).not.toBe(
      'person',
    )
  })

  it('does not mistake any text column for people', () => {
    const inferred = inferDatabase(
      [
        ['Block', 'Notes'],
        ['Catalog', 'the contract needs a review before the deadline'],
        ['Search', 'depends on the data team'],
      ],
      'Column',
      people,
    )

    expect(inferred?.properties[0].type).not.toBe('person')
  })
})
