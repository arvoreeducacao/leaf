import type { DatabasePropertyType } from '@/db/schema'

import {
  MAX_PROPERTIES,
  type SelectOption,
  coerceDate,
  colorForIndex,
  normalizeValue,
} from './values'

const MAX_LABEL_LENGTH = 40
const MAX_TOKEN_LENGTH = 24
const MAX_DISTINCT = 30
const SEPARATOR = ','

const booleanWords = new Set([
  'yes',
  'no',
  'sim',
  'não',
  'nao',
  'true',
  'false',
  'checked',
  'unchecked',
  '✓',
])

export type InferredProperty = Readonly<{
  name: string
  type: DatabasePropertyType
  options: Array<SelectOption>
}>

export type InferredRow = Readonly<{
  title: string
  values: Array<unknown>
}>

export type InferredDatabase = Readonly<{
  properties: Array<InferredProperty>
  rows: Array<InferredRow>
}>

function tokensOf(value: string): Array<string> {
  return value
    .split(SEPARATOR)
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
}

function looksBoolean(values: ReadonlyArray<string>): boolean {
  return values.every((value) => booleanWords.has(value.toLowerCase()))
}

function looksNumeric(values: ReadonlyArray<string>): boolean {
  return values.every((value) => normalizeValue('number', value) !== null)
}

function looksDate(values: ReadonlyArray<string>): boolean {
  return values.every((value) => /\d/.test(value) && coerceDate(value) !== null)
}

function looksUrl(values: ReadonlyArray<string>): boolean {
  return values.every((value) => /^https?:\/\/\S+$/i.test(value))
}

function repetitionCeiling(total: number): number {
  return Math.max(2, Math.ceil(total * 0.6))
}

function looksMultiSelect(values: ReadonlyArray<string>): boolean {
  if (!values.some((value) => value.includes(SEPARATOR))) {
    return false
  }

  const occurrences = values.flatMap(tokensOf)

  if (occurrences.some((token) => token.length > MAX_TOKEN_LENGTH)) {
    return false
  }

  const distinct = new Set(occurrences)

  return (
    distinct.size <= MAX_DISTINCT &&
    distinct.size <= repetitionCeiling(occurrences.length)
  )
}

function looksSelect(values: ReadonlyArray<string>): boolean {
  if (
    values.some(
      (value) => value.includes(SEPARATOR) || value.length > MAX_LABEL_LENGTH,
    )
  ) {
    return false
  }

  const distinct = new Set(values)

  return (
    distinct.size <= MAX_DISTINCT &&
    distinct.size <= repetitionCeiling(values.length)
  )
}

export function inferColumnType(
  values: ReadonlyArray<string>,
): DatabasePropertyType {
  const filled = values
    .map((value) => value.trim())
    .filter((value) => value.length > 0)

  if (filled.length === 0) {
    return 'text'
  }

  if (looksBoolean(filled)) {
    return 'checkbox'
  }

  if (looksNumeric(filled)) {
    return 'number'
  }

  if (looksDate(filled)) {
    return 'date'
  }

  if (looksUrl(filled)) {
    return 'url'
  }

  if (looksMultiSelect(filled)) {
    return 'multiSelect'
  }

  if (looksSelect(filled)) {
    return 'select'
  }

  return 'text'
}

function optionsFor(
  type: DatabasePropertyType,
  values: ReadonlyArray<string>,
): Array<SelectOption> {
  if (type !== 'select' && type !== 'multiSelect') {
    return []
  }

  const names: Array<string> = []

  for (const value of values) {
    const labels = type === 'multiSelect' ? tokensOf(value) : [value.trim()]

    for (const label of labels) {
      if (label.length > 0 && !names.includes(label)) {
        names.push(label)
      }
    }
  }

  return names.map((name, index) => ({
    id: `o${index + 1}`,
    name,
    color: colorForIndex(index),
  }))
}

function valueForCell(
  property: InferredProperty,
  cell: string,
): unknown {
  const trimmed = cell.trim()

  if (trimmed.length === 0) {
    return undefined
  }

  if (property.type === 'select' || property.type === 'multiSelect') {
    const labels =
      property.type === 'multiSelect' ? tokensOf(trimmed) : [trimmed]
    const ids = labels
      .map(
        (label) =>
          property.options.find((option) => option.name === label)?.id ?? null,
      )
      .filter((id): id is string => id !== null)

    return normalizeValue(property.type, ids, property.options)
  }

  return normalizeValue(property.type, trimmed)
}

export function inferDatabase(
  table: ReadonlyArray<ReadonlyArray<string>>,
  fallbackColumnName: string,
): InferredDatabase | null {
  const header = table[0]

  if (!header || header.length === 0) {
    return null
  }

  const body = table.slice(1)
  const columns = Math.min(header.length, MAX_PROPERTIES + 1)

  const properties: Array<InferredProperty> = []

  for (let column = 1; column < columns; column += 1) {
    const cells = body.map((row) => row[column] ?? '')
    const type = inferColumnType(cells)
    const filled = cells
      .map((cell) => cell.trim())
      .filter((cell) => cell.length > 0)
    const name = (header[column] ?? '').trim()

    properties.push({
      name:
        name.length > 0 ? name : `${fallbackColumnName} ${column}`,
      type,
      options: optionsFor(type, filled),
    })
  }

  const rows = body.map((row) => ({
    title: (row[0] ?? '').trim(),
    values: properties.map((property, index) =>
      valueForCell(property, row[index + 1] ?? ''),
    ),
  }))

  return { properties, rows }
}
