import type { DatabaseProperty } from '@/db/schema'

import type { Person } from './people'
import { type PropertyValue, parseOptions, serializeOptions } from './values'

export const CREATOR_TOKEN = '@creator'
export const NEXT_CYCLE_TOKEN = '@next-cycle'

const CYCLES_PER_YEAR = 6
const cycleName = /^\d{4}-0[1-6]$/

type PropertyShape = Pick<DatabaseProperty, 'type' | 'options'>

export type TemplateLabels = Readonly<{ creator: string; nextCycle: string }>

export function isCycleProperty(property: PropertyShape): boolean {
  if (property.type !== 'select' && property.type !== 'multiSelect') {
    return false
  }

  const options = parseOptions(property.options)

  return (
    options.length > 0 && options.every((option) => cycleName.test(option.name))
  )
}

export function nextCycleName(
  now: Date,
  timeZone = 'America/Sao_Paulo',
): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
  }).formatToParts(now)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const current = Math.ceil(month / 2)

  if (current === CYCLES_PER_YEAR) {
    return `${year + 1}-01`
  }

  return `${year}-${String(current + 1).padStart(2, '0')}`
}

export function withTemplatePeople(
  people: ReadonlyArray<Person>,
  labels: TemplateLabels,
): Array<Person> {
  return [
    { id: CREATOR_TOKEN, name: labels.creator, email: '', image: null },
    ...people,
  ]
}

export function withTemplateOptions<T extends PropertyShape>(
  property: T,
  labels: TemplateLabels,
): T {
  if (!isCycleProperty(property)) {
    return property
  }

  return {
    ...property,
    options: serializeOptions([
      { id: NEXT_CYCLE_TOKEN, name: labels.nextCycle, color: 'gray' },
      ...parseOptions(property.options),
    ]),
  }
}

export function replaceToken(
  value: PropertyValue,
  token: string,
  replacement: string,
): PropertyValue {
  if (Array.isArray(value)) {
    return [
      ...new Set(value.map((item) => (item === token ? replacement : item))),
    ]
  }

  return value === token ? replacement : value
}

export function holdsToken(value: unknown, token: string): boolean {
  return Array.isArray(value) ? value.includes(token) : value === token
}
