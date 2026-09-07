import type { DatabaseProperty, DatabasePropertyType } from '@/db/schema'
import { personOptions } from '@/lib/database/people'
import {
  type PropertyValue,
  type SelectOption,
  normalizeValue,
  parseOptions,
} from '@/lib/database/values'
import { listDatabasePeople } from '@/lib/databases'
import { McpToolError } from '@/lib/mcp/tools'

export const optionKinds: ReadonlyArray<DatabasePropertyType> = [
  'select',
  'multiSelect',
  'status',
]

export type PropertyRefValues = Readonly<Record<string, unknown>>

export function invalid(message: string): never {
  throw new McpToolError('invalid_argument', message)
}

export function findProperty(
  properties: ReadonlyArray<DatabaseProperty>,
  reference: string,
): DatabaseProperty {
  const needle = reference.trim().toLowerCase()
  const found =
    properties.find((property) => property.id === reference) ??
    properties.find((property) => property.name.toLowerCase() === needle)

  if (!found) {
    invalid(
      `unknown property "${reference}"; available: ${properties.map((property) => property.name).join(', ')}`,
    )
  }

  return found
}

function optionIdFor(
  property: DatabaseProperty,
  options: ReadonlyArray<SelectOption>,
  reference: unknown,
): string {
  const text = String(reference ?? '').trim()
  const found =
    options.find((option) => option.id === text) ??
    options.find((option) => option.name.toLowerCase() === text.toLowerCase())

  if (!found) {
    invalid(
      `unknown option "${text}" for "${property.name}"; available: ${options.map((option) => option.name).join(', ')}`,
    )
  }

  return found.id
}

export function optionIdsFor(
  property: DatabaseProperty,
  options: ReadonlyArray<SelectOption>,
  raw: unknown,
): PropertyValue {
  if (raw === null || raw === undefined || raw === '') {
    return property.type === 'multiSelect' ? [] : null
  }

  const list = Array.isArray(raw) ? raw : [raw]
  const ids = list.map((item) => optionIdFor(property, options, item))

  return property.type === 'multiSelect' ? ids : (ids[0] ?? null)
}

export async function rosterFor(orgId: string | null, viewerId: string) {
  if (!orgId) {
    return []
  }

  return personOptions(await listDatabasePeople(orgId, viewerId))
}

export async function normalizeIncoming(
  property: DatabaseProperty,
  raw: unknown,
  orgId: string | null,
  viewerId: string,
): Promise<PropertyValue> {
  if (property.type === 'uniqueId') {
    invalid(`"${property.name}" is assigned automatically`)
  }

  if (property.type === 'person') {
    const roster = await rosterFor(orgId, viewerId)

    if (raw === null || raw === undefined || raw === '') {
      return []
    }

    const list = Array.isArray(raw) ? raw : [raw]
    const ids = list.map((item) => {
      const text = String(item).trim().toLowerCase()
      const person = roster.find(
        (option) => option.id === item || option.name.toLowerCase() === text,
      )

      if (!person) {
        invalid(`unknown person "${String(item)}" for "${property.name}"`)
      }

      return person.id
    })

    return normalizeValue('person', ids, roster)
  }

  const options = parseOptions(property.options)

  if (optionKinds.includes(property.type)) {
    return normalizeValue(
      property.type,
      optionIdsFor(property, options, raw),
      options,
    )
  }

  return normalizeValue(property.type, raw, options)
}

export async function valuesFrom(
  incoming: PropertyRefValues | undefined,
  properties: ReadonlyArray<DatabaseProperty>,
  orgId: string | null,
  viewerId: string,
): Promise<Record<string, PropertyValue>> {
  const values: Record<string, PropertyValue> = {}

  for (const [reference, raw] of Object.entries(incoming ?? {})) {
    const property = findProperty(properties, reference)

    values[property.id] = await normalizeIncoming(property, raw, orgId, viewerId)
  }

  return values
}
