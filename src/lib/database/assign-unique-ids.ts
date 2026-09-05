import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/db'
import { databaseProperties, documents } from '@/db/schema'
import type { DatabaseProperty, DatabasePropertyType } from '@/db/schema'
import { listDatabaseProperties, listDatabaseRows } from '@/lib/databases'

import {
  type PropertyRefresh,
  type UniqueIdConfig,
  formatUniqueId,
  parseUniqueIdConfig,
  planUniqueIds,
  serializeUniqueIdConfig,
  toUniqueIdNumber,
} from './unique-id'
import { type PropertyValue, normalizeValue, serializeValues } from './values'

const UNIQUE_ID_RESERVE_ATTEMPTS = 5

export async function reserveUniqueIdNumbers(
  propertyId: string,
  count: number,
): Promise<Array<number>> {
  if (count <= 0) {
    return []
  }

  for (let attempt = 0; attempt < UNIQUE_ID_RESERVE_ATTEMPTS; attempt += 1) {
    const property = await db.query.databaseProperties.findFirst({
      where: eq(databaseProperties.id, propertyId),
    })

    if (!property || property.type !== 'uniqueId') {
      return []
    }

    const config = parseUniqueIdConfig(property.options)
    const next: UniqueIdConfig = {
      prefix: config.prefix,
      next: config.next + count,
    }

    const result = await db
      .update(databaseProperties)
      .set({ options: serializeUniqueIdConfig(next) })
      .where(
        and(
          eq(databaseProperties.id, propertyId),
          property.options === null
            ? isNull(databaseProperties.options)
            : eq(databaseProperties.options, property.options),
        ),
      )

    if (rowsTouched(result) === 1) {
      return Array.from({ length: count }, (_, index) => config.next + index)
    }
  }

  return []
}

function rowsTouched(result: unknown): number {
  if (Array.isArray(result)) {
    const header = result[0] as { affectedRows?: unknown } | undefined

    return typeof header?.affectedRows === 'number' ? header.affectedRows : 0
  }

  const header = result as { affectedRows?: unknown }

  return typeof header?.affectedRows === 'number' ? header.affectedRows : 0
}

export async function seedUniqueIdProperty(
  databaseId: string,
  propertyId: string,
  previous: ReadonlyArray<DatabaseProperty> = [],
): Promise<PropertyRefresh> {
  const source = previous.find((item) => item.id === propertyId)
  const rows = await listDatabaseRows(databaseId)
  const plan = planUniqueIds(
    rows.map((row) => ({
      id: row.id,
      value: source ? (row.values[propertyId] ?? null) : null,
    })),
  )

  const options = serializeUniqueIdConfig({
    prefix: plan.prefix,
    next: plan.next,
  })

  await db
    .update(databaseProperties)
    .set({ options })
    .where(eq(databaseProperties.id, propertyId))

  const values: Array<{ rowId: string; value: PropertyValue }> = []

  for (const assignment of plan.assignments) {
    const row = rows.find((item) => item.id === assignment.rowId)

    if (!row) {
      continue
    }

    await db
      .update(documents)
      .set({
        properties: serializeValues({
          ...row.values,
          [propertyId]: assignment.number,
        }),
      })
      .where(eq(documents.id, assignment.rowId))

    values.push({ rowId: assignment.rowId, value: assignment.number })
  }

  return { options, values }
}

export async function unwrapUniqueIdProperty(
  databaseId: string,
  property: DatabaseProperty,
  type: DatabasePropertyType,
): Promise<PropertyRefresh> {
  const prefix = parseUniqueIdConfig(property.options).prefix
  const rows = await listDatabaseRows(databaseId)
  const values: Array<{ rowId: string; value: PropertyValue }> = []

  for (const row of rows) {
    const text = formatUniqueId(row.values[property.id] ?? null, prefix)
    const value = normalizeValue(type, text)

    await db
      .update(documents)
      .set({
        properties: serializeValues({ ...row.values, [property.id]: value }),
      })
      .where(eq(documents.id, row.id))

    values.push({ rowId: row.id, value })
  }

  return { options: null, values }
}

export async function fillMissingUniqueIds(databaseId: string): Promise<void> {
  const properties = await listDatabaseProperties(databaseId)
  const targets = properties.filter((item) => item.type === 'uniqueId')

  if (targets.length === 0) {
    return
  }

  const rows = await listDatabaseRows(databaseId)
  const pending = new Map<string, Record<string, number>>()

  for (const property of targets) {
    const missing = rows.filter(
      (row) => toUniqueIdNumber(row.values[property.id] ?? null) === null,
    )

    if (missing.length === 0) {
      continue
    }

    const numbers = await reserveUniqueIdNumbers(property.id, missing.length)

    for (const [index, row] of missing.entries()) {
      const number = numbers[index]

      if (number === undefined) {
        continue
      }

      pending.set(row.id, { ...pending.get(row.id), [property.id]: number })
    }
  }

  for (const [rowId, values] of pending) {
    const row = rows.find((item) => item.id === rowId)

    if (!row) {
      continue
    }

    await db
      .update(documents)
      .set({ properties: serializeValues({ ...row.values, ...values }) })
      .where(and(eq(documents.id, rowId), isNull(documents.deletedAt)))
  }
}
