import type {
  DatabaseProperty,
  DatabasePropertyType,
  DatabaseView,
  DatabaseViewType,
} from '@/db/schema'

import { parseUniqueIdConfig, toUniqueIdNumber } from './unique-id'
import {
  type FormConfig,
  parseFormConfig,
  serializeFormConfig,
} from './forms'
import {
  type PropertyValue,
  type PropertyValues,
  type SelectOption,
  isEmptyValue,
  normalizeValue,
  parseOptions,
  sortByStatusGroup,
  valueToText,
} from './values'

export const TITLE_PROPERTY_ID = 'title'

export const DEFAULT_VIEW_ID = 'default'

export const viewTypes: ReadonlyArray<DatabaseViewType> = [
  'table',
  'board',
  'form',
  'gallery',
  'list',
  'calendar',
  'timeline',
]

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
  'isMe',
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
  person: ['isMe', 'contains', 'notContains', 'isEmpty', 'isNotEmpty'],
  status: ['is', 'isNot', 'isEmpty', 'isNotEmpty'],
  uniqueId: ['is', 'contains', 'greaterThan', 'lessThan'],
}

export function operatorsFor(
  type: DatabasePropertyType,
): ReadonlyArray<FilterOperator> {
  return operatorsByType[type]
}

export function operatorNeedsValue(operator: FilterOperator): boolean {
  return (
    operator !== 'isEmpty' && operator !== 'isNotEmpty' && operator !== 'isMe'
  )
}

export function isMultiValueType(type: DatabasePropertyType): boolean {
  return type === 'multiSelect' || type === 'person'
}

export function filterValueFor(
  type: DatabasePropertyType,
  value: PropertyValue,
): PropertyValue {
  return isMultiValueType(type) && typeof value === 'string' ? [value] : value
}

export function isGroupableType(type: DatabasePropertyType): boolean {
  return type === 'select' || type === 'status' || type === 'person'
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
  datePropertyId: string | null
  endDatePropertyId: string | null
  filters: ReadonlyArray<ViewFilter>
  sorts: ReadonlyArray<ViewSort>
  hiddenPropertyIds: ReadonlyArray<string>
  wrapCells: boolean
  showVerticalLines: boolean
  showPageIcon: boolean
  form: FormConfig | null
}>

export const emptyViewConfig: ViewConfig = {
  groupByPropertyId: null,
  datePropertyId: null,
  endDatePropertyId: null,
  filters: [],
  sorts: [],
  hiddenPropertyIds: [],
  wrapCells: true,
  showVerticalLines: true,
  showPageIcon: true,
  form: null,
}

export function defaultTableView(
  databaseId: string,
  name: string,
): DatabaseView {
  return {
    id: DEFAULT_VIEW_ID,
    databaseId,
    name,
    type: 'table',
    config: serializeViewConfig(emptyViewConfig),
    publicToken: null,
    position: 0,
    createdAt: new Date(0),
  }
}

export type DatabaseRow = Readonly<{
  id: string
  title: string
  icon: string | null
  cover: string | null
  preview: string | null
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
    datePropertyId:
      typeof source.datePropertyId === 'string' ? source.datePropertyId : null,
    endDatePropertyId:
      typeof source.endDatePropertyId === 'string'
        ? source.endDatePropertyId
        : null,
    filters,
    sorts,
    hiddenPropertyIds: asStringArray(source.hiddenPropertyIds),
    wrapCells: source.wrapCells !== false,
    showVerticalLines: source.showVerticalLines !== false,
    showPageIcon: source.showPageIcon !== false,
    form: parseFormConfig(source.form),
  }
}

export function serializeViewConfig(config: ViewConfig): string {
  return JSON.stringify({
    groupByPropertyId: config.groupByPropertyId,
    filters: config.filters.slice(0, MAX_FILTERS),
    sorts: config.sorts.slice(0, MAX_SORTS),
    datePropertyId: config.datePropertyId,
    endDatePropertyId: config.endDatePropertyId,
    hiddenPropertyIds: config.hiddenPropertyIds,
    wrapCells: config.wrapCells,
    showVerticalLines: config.showVerticalLines,
    showPageIcon: config.showPageIcon,
    form: config.form ? serializeFormConfig(config.form) : null,
  })
}

type PropertyLike = Pick<DatabaseProperty, 'id' | 'type' | 'options'>

function readValue(
  row: DatabaseRow,
  property: PropertyLike,
  people: ReadonlyArray<SelectOption> = [],
): { value: PropertyValue; options: Array<SelectOption> } {
  const options =
    property.type === 'person' ? [...people] : parseOptions(property.options)
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

function waitsForValue(filter: ViewFilter): boolean {
  return (
    operatorNeedsValue(filter.operator) &&
    typeof filter.value !== 'boolean' &&
    isEmptyValue(filter.value)
  )
}

function matchesFilter(
  row: DatabaseRow,
  filter: ViewFilter,
  properties: ReadonlyArray<PropertyLike>,
  viewerId: string | null,
  people: ReadonlyArray<SelectOption>,
): boolean {
  if (waitsForValue(filter)) {
    return true
  }

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

  const { value, options } = readValue(row, property, people)

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

  if (property.type === 'uniqueId') {
    const prefix = parseUniqueIdConfig(property.options).prefix

    if (filter.operator === 'contains') {
      const haystack = valueToText(value, 'uniqueId', [], 'pt-BR', prefix)

      return haystack.toLowerCase().includes(textOf(filter.value))
    }

    const target = toUniqueIdNumber(filter.value)

    if (typeof value !== 'number' || target === null) {
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

  if (property.type === 'select' || property.type === 'status') {
    if (filter.operator === 'isNot') {
      return value !== filter.value
    }

    return value === filter.value
  }

  if (property.type === 'multiSelect' || property.type === 'person') {
    const selected = Array.isArray(value) ? value : []

    if (filter.operator === 'isMe') {
      return viewerId !== null && selected.includes(viewerId)
    }

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

export function foldText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export function applySearch(
  rows: ReadonlyArray<DatabaseRow>,
  term: string,
  properties: ReadonlyArray<PropertyLike>,
  people: ReadonlyArray<SelectOption> = [],
): Array<DatabaseRow> {
  const needle = foldText(term)

  if (needle.length === 0) {
    return [...rows]
  }

  return rows.filter((row) => {
    if (foldText(row.title).includes(needle)) {
      return true
    }

    return properties.some((property) => {
      const { value, options } = readValue(row, property, people)

      return foldText(
        valueToText(
          value,
          property.type,
          options,
          'pt-BR',
          parseUniqueIdConfig(property.options).prefix,
        ),
      ).includes(needle)
    })
  })
}

export function applyFilters(
  rows: ReadonlyArray<DatabaseRow>,
  filters: ReadonlyArray<ViewFilter>,
  properties: ReadonlyArray<PropertyLike>,
  viewerId: string | null = null,
  people: ReadonlyArray<SelectOption> = [],
): Array<DatabaseRow> {
  if (filters.length === 0) {
    return [...rows]
  }

  return rows.filter((row) =>
    filters.every((filter) =>
      matchesFilter(row, filter, properties, viewerId, people),
    ),
  )
}

function comparableOf(
  row: DatabaseRow,
  propertyId: string,
  properties: ReadonlyArray<PropertyLike>,
  people: ReadonlyArray<SelectOption>,
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

  const { value, options } = readValue(row, property, people)

  if (property.type === 'number' || property.type === 'uniqueId') {
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

  if (
    property.type === 'select' ||
    property.type === 'multiSelect' ||
    property.type === 'status' ||
    property.type === 'person'
  ) {
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
  people: ReadonlyArray<SelectOption> = [],
): Array<DatabaseRow> {
  if (sorts.length === 0) {
    return [...rows]
  }

  return [...rows].sort((left, right) => {
    for (const sort of sorts) {
      const a = comparableOf(left, sort.propertyId, properties, people)
      const b = comparableOf(right, sort.propertyId, properties, people)

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
  options: ReadonlyArray<SelectOption> = [],
): Array<BoardGroup> {
  if (!property) {
    return [{ id: null, name: emptyLabel, color: null, rows: [...rows] }]
  }

  const known =
    property.type === 'person' ? [...options] : parseOptions(property.options)
  const ordered =
    property.type === 'status' ? sortByStatusGroup(known) : known
  const groups = new Map<string | null, Array<DatabaseRow>>()

  groups.set(null, [])

  for (const option of ordered) {
    groups.set(option.id, [])
  }

  for (const row of rows) {
    const { value } = readValue(row, property, options)
    const keys = keysOf(value)

    if (keys.length === 0) {
      groups.get(null)?.push(row)
      continue
    }

    for (const key of keys) {
      const bucket = groups.get(key)

      if (bucket) {
        bucket.push(row)
      } else {
        groups.get(null)?.push(row)
      }
    }
  }

  const result: Array<BoardGroup> = ordered.map((option) => ({
    id: option.id,
    name: option.name,
    color: option.color,
    rows: groups.get(option.id) ?? [],
  }))

  result.push({
    id: null,
    name: emptyLabel,
    color: null,
    rows: groups.get(null) ?? [],
  })

  return result
}

function keysOf(value: PropertyValue): Array<string> {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === 'string' && item.length > 0,
    )
  }

  return typeof value === 'string' && value.length > 0 ? [value] : []
}

export function boardPropertyOf(
  properties: ReadonlyArray<PropertyLike>,
  config: ViewConfig,
): PropertyLike | null {
  const chosen = properties.find(
    (property) =>
      property.id === config.groupByPropertyId && isGroupableType(property.type),
  )

  if (chosen) {
    return chosen
  }

  return properties.find((property) => isGroupableType(property.type)) ?? null
}
