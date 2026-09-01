import type {
  DatabaseProperty,
  DatabasePropertyType,
  DatabaseViewType,
} from '@/db/schema'

import {
  type PropertyValue,
  type PropertyValues,
  type SelectOption,
  isEmptyValue,
  normalizeValue,
  parseOptions,
  valueToText,
} from './values'

export const TITLE_PROPERTY_ID = 'title'

export const viewTypes: ReadonlyArray<DatabaseViewType> = ['table', 'board']

export const MAX_FILTERS = 10
export const MAX_SORTS = 5
export const MAX_VIEWS = 20

export const filterOperators = [
  'is',
  'isNot',
  'contains',
  'notContains',
  'greaterThan',
  'lessThan',
  'before',
  'after',
  'isEmpty',
  'isNotEmpty',
] as const

export type FilterOperator = (typeof filterOperators)[number]

const operatorsByType: Record<
  DatabasePropertyType,
  ReadonlyArray<FilterOperator>
> = {
  text: ['contains', 'notContains', 'is', 'isEmpty', 'isNotEmpty'],
  url: ['contains', 'notContains', 'is', 'isEmpty', 'isNotEmpty'],
  number: ['is', 'greaterThan', 'lessThan', 'isEmpty', 'isNotEmpty'],
  select: ['is', 'isNot', 'isEmpty', 'isNotEmpty'],
  multiSelect: ['contains', 'notContains', 'isEmpty', 'isNotEmpty'],
  date: ['is', 'before', 'after', 'isEmpty', 'isNotEmpty'],
  checkbox: ['is'],
}

export function operatorsFor(
  type: DatabasePropertyType,
): ReadonlyArray<FilterOperator> {
  return operatorsByType[type]
}

export function operatorNeedsValue(operator: FilterOperator): boolean {
  return operator !== 'isEmpty' && operator !== 'isNotEmpty'
}

export type ViewFilter = Readonly<{
  propertyId: string
  operator: FilterOperator
  value: PropertyValue
}>

export type ViewSort = Readonly<{
  propertyId: string
  direction: 'asc' | 'desc'
}>

export type ViewConfig = Readonly<{
  groupByPropertyId: string | null
  filters: ReadonlyArray<ViewFilter>
  sorts: ReadonlyArray<ViewSort>
  hiddenPropertyIds: ReadonlyArray<string>
}>

export const emptyViewConfig: ViewConfig = {
  groupByPropertyId: null,
  filters: [],
  sorts: [],
  hiddenPropertyIds: [],
}

export type DatabaseRow = Readonly<{
  id: string
  title: string
  values: PropertyValues
  createdAt: string
  updatedAt: string
}>

function asStringArray(value: unknown): Array<string> {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

export function parseViewConfig(raw: string | null): ViewConfig {
  if (!raw) {
    return emptyViewConfig
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyViewConfig
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return emptyViewConfig
  }

  const source = parsed as Record<string, unknown>

  const filters = (Array.isArray(source.filters) ? source.filters : [])
    .filter((item): item is Record<string, unknown> => {
      if (typeof item !== 'object' || item === null) {
        return false
      }

      const candidate = item as Record<string, unknown>

      return (
        typeof candidate.propertyId === 'string' &&
        filterOperators.includes(candidate.operator as FilterOperator)
      )
    })
    .slice(0, MAX_FILTERS)
    .map((item) => ({
      propertyId: item.propertyId as string,
      operator: item.operator as FilterOperator,
      value: (item.value ?? null) as PropertyValue,
    }))

  const sorts = (Array.isArray(source.sorts) ? source.sorts : [])
    .filter((item): item is Record<string, unknown> => {
      if (typeof item !== 'object' || item === null) {
        return false
      }

      const candidate = item as Record<string, unknown>

      return (
        typeof candidate.propertyId === 'string' &&
        (candidate.direction === 'asc' || candidate.direction === 'desc')
      )
    })
    .slice(0, MAX_SORTS)
    .map((item) => ({
      propertyId: item.propertyId as string,
      direction: item.direction as 'asc' | 'desc',
    }))

  return {
    groupByPropertyId:
      typeof source.groupByPropertyId === 'string'
        ? source.groupByPropertyId
        : null,
    filters,
    sorts,
    hiddenPropertyIds: asStringArray(source.hiddenPropertyIds),
  }
}

export function serializeViewConfig(config: ViewConfig): string {
  return JSON.stringify({
    groupByPropertyId: config.groupByPropertyId,
    filters: config.filters.slice(0, MAX_FILTERS),
    sorts: config.sorts.slice(0, MAX_SORTS),
    hiddenPropertyIds: config.hiddenPropertyIds,
  })
}

type PropertyLike = Pick<DatabaseProperty, 'id' | 'type' | 'options'>

function readValue(
  row: DatabaseRow,
  property: PropertyLike,
): { value: PropertyValue; options: Array<SelectOption> } {
  const options = parseOptions(property.options)
  const raw = row.values[property.id]

  return {
    value:
      raw === undefined ? null : normalizeValue(property.type, raw, options),
    options,
  }
}

function textOf(value: PropertyValue): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

function matchesFilter(
  row: DatabaseRow,
  filter: ViewFilter,
  properties: ReadonlyArray<PropertyLike>,
): boolean {
  if (filter.propertyId === TITLE_PROPERTY_ID) {
    const title = row.title.trim().toLowerCase()
    const target = textOf(filter.value)

    if (filter.operator === 'isEmpty') {
      return title.length === 0
    }

    if (filter.operator === 'isNotEmpty') {
      return title.length > 0
    }

    if (filter.operator === 'is') {
      return title === target
    }

    if (filter.operator === 'notContains') {
      return !title.includes(target)
    }

    return title.includes(target)
  }

  const property = properties.find((item) => item.id === filter.propertyId)

  if (!property) {
    return true
  }

  const { value, options } = readValue(row, property)

  if (filter.operator === 'isEmpty') {
    return isEmptyValue(value)
  }

  if (filter.operator === 'isNotEmpty') {
    return !isEmptyValue(value)
  }

  if (property.type === 'checkbox') {
    return (value === true) === (filter.value === true)
  }

  if (property.type === 'number') {
    const target =
      typeof filter.value === 'number'
        ? filter.value
        : Number(normalizeValue('number', filter.value))

    if (typeof value !== 'number' || Number.isNaN(target)) {
      return false
    }

    if (filter.operator === 'greaterThan') {
      return value > target
    }

    if (filter.operator === 'lessThan') {
      return value < target
    }

    return value === target
  }

  if (property.type === 'date') {
    const target = typeof filter.value === 'string' ? filter.value : ''

    if (typeof value !== 'string' || target.length === 0) {
      return false
    }

    if (filter.operator === 'before') {
      return value < target
    }

    if (filter.operator === 'after') {
      return value > target
    }

    return value === target
  }

  if (property.type === 'select') {
    if (filter.operator === 'isNot') {
      return value !== filter.value
    }

    return value === filter.value
  }

  if (property.type === 'multiSelect') {
    const selected = Array.isArray(value) ? value : []
    const target = typeof filter.value === 'string' ? filter.value : ''

    if (filter.operator === 'notContains') {
      return !selected.includes(target)
    }

    return selected.includes(target)
  }

  const haystack = valueToText(value, property.type, options).toLowerCase()
  const needle = textOf(filter.value)

  if (filter.operator === 'is') {
    return haystack === needle
  }

  if (filter.operator === 'notContains') {
    return !haystack.includes(needle)
  }

  return haystack.includes(needle)
}

export function applyFilters(
  rows: ReadonlyArray<DatabaseRow>,
  filters: ReadonlyArray<ViewFilter>,
  properties: ReadonlyArray<PropertyLike>,
): Array<DatabaseRow> {
  if (filters.length === 0) {
    return [...rows]
  }

  return rows.filter((row) =>
    filters.every((filter) => matchesFilter(row, filter, properties)),
  )
}

function comparableOf(
  row: DatabaseRow,
  propertyId: string,
  properties: ReadonlyArray<PropertyLike>,
): { empty: boolean; text: string; number: number | null; flag: boolean } {
  if (propertyId === TITLE_PROPERTY_ID) {
    const title = row.title.trim()

    return {
      empty: title.length === 0,
      text: title.toLocaleLowerCase(),
      number: null,
      flag: false,
    }
  }

  const property = properties.find((item) => item.id === propertyId)

  if (!property) {
    return { empty: true, text: '', number: null, flag: false }
  }

  const { value, options } = readValue(row, property)

  if (property.type === 'number') {
    return {
      empty: typeof value !== 'number',
      text: '',
      number: typeof value === 'number' ? value : null,
      flag: false,
    }
  }

  if (property.type === 'checkbox') {
    return { empty: false, text: '', number: null, flag: value === true }
  }

  if (property.type === 'date') {
    const text = typeof value === 'string' ? value : ''

    return { empty: text.length === 0, text, number: null, flag: false }
  }

  if (property.type === 'select' || property.type === 'multiSelect') {
    const order = new Map(options.map((option, index) => [option.id, index]))
    const first = Array.isArray(value) ? value[0] : value

    return {
      empty: isEmptyValue(value),
      text: '',
      number:
        typeof first === 'string' ? (order.get(first) ?? Number.NaN) : null,
      flag: false,
    }
  }

  const text = valueToText(value, property.type, options).toLocaleLowerCase()

  return { empty: text.length === 0, text, number: null, flag: false }
}

export function applySorts(
  rows: ReadonlyArray<DatabaseRow>,
  sorts: ReadonlyArray<ViewSort>,
  properties: ReadonlyArray<PropertyLike>,
): Array<DatabaseRow> {
  if (sorts.length === 0) {
    return [...rows]
  }

  return [...rows].sort((left, right) => {
    for (const sort of sorts) {
      const a = comparableOf(left, sort.propertyId, properties)
      const b = comparableOf(right, sort.propertyId, properties)

      if (a.empty !== b.empty) {
        return a.empty ? 1 : -1
      }

      let comparison = 0

      if (a.number !== null || b.number !== null) {
        const first = a.number ?? Number.POSITIVE_INFINITY
        const second = b.number ?? Number.POSITIVE_INFINITY

        comparison = first === second ? 0 : first < second ? -1 : 1
      } else if (a.flag !== b.flag) {
        comparison = a.flag ? -1 : 1
      } else {
        comparison = a.text.localeCompare(b.text)
      }

      if (comparison !== 0) {
        return sort.direction === 'asc' ? comparison : -comparison
      }
    }

    return 0
  })
}

export function visibleProperties<T extends { id: string }>(
  properties: ReadonlyArray<T>,
  config: ViewConfig,
): Array<T> {
  const hidden = new Set(config.hiddenPropertyIds)

  return properties.filter((property) => !hidden.has(property.id))
}

export type BoardGroup = Readonly<{
  id: string | null
  name: string
  color: SelectOption['color'] | null
  rows: Array<DatabaseRow>
}>

export function groupRows(
  rows: ReadonlyArray<DatabaseRow>,
  property: PropertyLike | null,
  emptyLabel: string,
): Array<BoardGroup> {
  if (!property) {
    return [{ id: null, name: emptyLabel, color: null, rows: [...rows] }]
  }

  const options = parseOptions(property.options)
  const groups = new Map<string | null, Array<DatabaseRow>>()

  groups.set(null, [])

  for (const option of options) {
    groups.set(option.id, [])
  }

  for (const row of rows) {
    const { value } = readValue(row, property)
    const key = typeof value === 'string' && value.length > 0 ? value : null
    const bucket = groups.get(key) ?? groups.get(null)

    bucket?.push(row)
  }

  const ordered: Array<BoardGroup> = options.map((option) => ({
    id: option.id,
    name: option.name,
    color: option.color,
    rows: groups.get(option.id) ?? [],
  }))

  ordered.push({
    id: null,
    name: emptyLabel,
    color: null,
    rows: groups.get(null) ?? [],
  })

  return ordered
}

export function boardPropertyOf(
  properties: ReadonlyArray<PropertyLike>,
  config: ViewConfig,
): PropertyLike | null {
  const chosen = properties.find(
    (property) =>
      property.id === config.groupByPropertyId && property.type === 'select',
  )

  if (chosen) {
    return chosen
  }

  return properties.find((property) => property.type === 'select') ?? null
}
