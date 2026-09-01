import type { DatabaseProperty, DatabasePropertyType } from '@/db/schema'

export const propertyTypes: ReadonlyArray<DatabasePropertyType> = [
  'text',
  'number',
  'select',
  'multiSelect',
  'date',
  'checkbox',
  'url',
]

export const optionColors = [
  'gray',
  'primary',
  'blue',
  'lime',
  'orange',
  'purple',
  'warning',
  'error',
  'success',
] as const

export type OptionColor = (typeof optionColors)[number]

export type SelectOption = Readonly<{
  id: string
  name: string
  color: OptionColor
}>

export type PropertyValue =
  | string
  | number
  | boolean
  | ReadonlyArray<string>
  | null

export type PropertyValues = Readonly<Record<string, PropertyValue>>

export const MAX_PROPERTY_NAME = 120
export const MAX_TEXT_VALUE = 2_000
export const MAX_MULTI_SELECT_VALUES = 40
export const MAX_PROPERTIES = 60
export const MAX_SELECT_OPTIONS = 100

const datePattern = /^\d{4}-\d{2}-\d{2}$/

export function colorForIndex(index: number): OptionColor {
  return optionColors[Math.abs(index) % optionColors.length]
}

export function isSelectOption(value: unknown): value is SelectOption {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as Record<string, unknown>

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    optionColors.includes(candidate.color as OptionColor)
  )
}

export function parseOptions(raw: string | null): Array<SelectOption> {
  if (!raw) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)

    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isSelectOption).slice(0, MAX_SELECT_OPTIONS)
  } catch {
    return []
  }
}

export function serializeOptions(options: ReadonlyArray<SelectOption>): string {
  return JSON.stringify(options.slice(0, MAX_SELECT_OPTIONS))
}

export function parseValues(raw: string | null): PropertyValues {
  if (!raw) {
    return {}
  }

  try {
    const parsed: unknown = JSON.parse(raw)

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {}
    }

    return parsed as PropertyValues
  } catch {
    return {}
  }
}

export function serializeValues(values: PropertyValues): string {
  return JSON.stringify(values)
}

export function emptyValueFor(type: DatabasePropertyType): PropertyValue {
  if (type === 'checkbox') {
    return false
  }

  if (type === 'multiSelect') {
    return []
  }

  if (type === 'text' || type === 'url') {
    return ''
  }

  return null
}

function coerceText(value: unknown): string {
  if (typeof value === 'string') {
    return value.slice(0, MAX_TEXT_VALUE)
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }

  return ''
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d,.\-+eE]/g, '')

  if (normalized.length === 0) {
    return null
  }

  const lastComma = normalized.lastIndexOf(',')
  const lastDot = normalized.lastIndexOf('.')
  const decimalSeparator = lastComma > lastDot ? ',' : '.'

  const cleaned =
    decimalSeparator === ','
      ? normalized.replace(/\./g, '').replace(',', '.')
      : normalized.replace(/,/g, '')

  const parsed = Number(cleaned)

  return Number.isFinite(parsed) ? parsed : null
}

export function coerceDate(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return null
  }

  if (datePattern.test(trimmed)) {
    return trimmed
  }

  const brazilian = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed)

  if (brazilian) {
    return `${brazilian[3]}-${brazilian[2]}-${brazilian[1]}`
  }

  const parsed = new Date(trimmed)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

function coerceCheckbox(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'number') {
    return value !== 0
  }

  if (typeof value !== 'string') {
    return false
  }

  return ['true', 'yes', 'sim', '1', 'x', 'checked'].includes(
    value.trim().toLowerCase(),
  )
}

function coerceOptionIds(
  value: unknown,
  options: ReadonlyArray<SelectOption>,
): Array<string> {
  const known = new Set(options.map((option) => option.id))
  const list = Array.isArray(value) ? value : [value]

  return list
    .filter((item): item is string => typeof item === 'string')
    .filter((item) => known.has(item))
    .slice(0, MAX_MULTI_SELECT_VALUES)
}

export function normalizeValue(
  type: DatabasePropertyType,
  value: unknown,
  options: ReadonlyArray<SelectOption> = [],
): PropertyValue {
  if (type === 'checkbox') {
    return coerceCheckbox(value)
  }

  if (type === 'number') {
    return coerceNumber(value)
  }

  if (type === 'date') {
    return coerceDate(value)
  }

  if (type === 'select') {
    return coerceOptionIds(value, options)[0] ?? null
  }

  if (type === 'multiSelect') {
    return coerceOptionIds(value, options)
  }

  if (type === 'url') {
    const text = coerceText(value).trim()

    return text
  }

  return coerceText(value)
}

export function valueOf(
  values: PropertyValues,
  property: Pick<DatabaseProperty, 'id' | 'type'>,
  options: ReadonlyArray<SelectOption> = [],
): PropertyValue {
  const raw = values[property.id]

  if (raw === undefined) {
    return emptyValueFor(property.type)
  }

  return normalizeValue(property.type, raw, options)
}

export function isEmptyValue(value: PropertyValue): boolean {
  if (value === null || value === undefined) {
    return true
  }

  if (typeof value === 'string') {
    return value.trim().length === 0
  }

  if (Array.isArray(value)) {
    return value.length === 0
  }

  if (typeof value === 'boolean') {
    return value === false
  }

  return false
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 10 }).format(
    value,
  )
}

export function formatDate(value: string, locale: string): string {
  const parsed = new Date(`${value}T00:00:00Z`)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}

export function valueToText(
  value: PropertyValue,
  type: DatabasePropertyType,
  options: ReadonlyArray<SelectOption>,
  locale = 'pt-BR',
): string {
  if (type === 'checkbox') {
    return value === true ? '✓' : ''
  }

  if (value === null || value === undefined) {
    return ''
  }

  if (type === 'number') {
    return typeof value === 'number' ? formatNumber(value, locale) : ''
  }

  if (type === 'date') {
    return typeof value === 'string' ? formatDate(value, locale) : ''
  }

  const names = new Map(options.map((option) => [option.id, option.name]))

  if (type === 'select') {
    return typeof value === 'string' ? (names.get(value) ?? '') : ''
  }

  if (type === 'multiSelect') {
    return Array.isArray(value)
      ? value.map((id) => names.get(id) ?? '').filter(Boolean).join(', ')
      : ''
  }

  return typeof value === 'string' ? value : ''
}
