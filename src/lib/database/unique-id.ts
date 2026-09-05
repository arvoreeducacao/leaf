import type { PropertyValue } from './values'

export const MAX_UNIQUE_ID_PREFIX = 12

export type UniqueIdConfig = Readonly<{
  prefix: string
  next: number
}>

export const emptyUniqueIdConfig: UniqueIdConfig = { prefix: '', next: 1 }

const prefixPattern = /^[A-Za-z][A-Za-z0-9]*$/
const textPattern = /^\s*(?:([A-Za-z][A-Za-z0-9]*)\s*-\s*)?(\d{1,15})\s*$/

export function normalizeUniqueIdPrefix(value: unknown): string {
  if (typeof value !== 'string') {
    return ''
  }

  const trimmed = value.trim().slice(0, MAX_UNIQUE_ID_PREFIX)

  return prefixPattern.test(trimmed) ? trimmed : ''
}

export function parseUniqueIdConfig(raw: string | null): UniqueIdConfig {
  if (!raw) {
    return emptyUniqueIdConfig
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyUniqueIdConfig
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return emptyUniqueIdConfig
  }

  const source = parsed as Record<string, unknown>
  const next =
    typeof source.next === 'number' && Number.isFinite(source.next)
      ? Math.max(1, Math.trunc(source.next))
      : 1

  return { prefix: normalizeUniqueIdPrefix(source.prefix), next }
}

export function serializeUniqueIdConfig(config: UniqueIdConfig): string {
  return JSON.stringify({
    prefix: normalizeUniqueIdPrefix(config.prefix),
    next: Math.max(1, Math.trunc(config.next)),
  })
}

export function toUniqueIdNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const match = textPattern.exec(value)

  if (!match) {
    return null
  }

  const parsed = Number(match[2])

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function prefixOfText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const match = textPattern.exec(value)

  return match?.[1] ?? null
}

export function formatUniqueId(value: PropertyValue, prefix: string): string {
  const number = toUniqueIdNumber(value)

  if (number === null) {
    return ''
  }

  const safe = normalizeUniqueIdPrefix(prefix)

  return safe.length > 0 ? `${safe}-${number}` : String(number)
}

export type PropertyRefresh = Readonly<{
  options: string | null
  values: ReadonlyArray<Readonly<{ rowId: string; value: PropertyValue }>>
}>

export type UniqueIdAssignment = Readonly<{
  rowId: string
  number: number
}>

export type UniqueIdPlan = Readonly<{
  prefix: string
  next: number
  assignments: ReadonlyArray<UniqueIdAssignment>
}>

export function planUniqueIds(
  rows: ReadonlyArray<Readonly<{ id: string; value: unknown }>>,
  startAt = 1,
): UniqueIdPlan {
  const prefixes = new Set<string>()
  const taken = new Set<number>()
  const kept = new Map<string, number>()

  for (const row of rows) {
    const number = toUniqueIdNumber(row.value)

    if (number === null || taken.has(number)) {
      continue
    }

    taken.add(number)
    kept.set(row.id, number)

    const found = prefixOfText(row.value)

    if (found !== null) {
      prefixes.add(found)
    }
  }

  let cursor = Math.max(
    Math.trunc(startAt),
    ...[...taken].map((number) => number + 1),
    1,
  )

  const assignments: Array<UniqueIdAssignment> = []

  for (const row of rows) {
    const existing = kept.get(row.id)

    if (existing !== undefined) {
      assignments.push({ rowId: row.id, number: existing })

      continue
    }

    assignments.push({ rowId: row.id, number: cursor })
    cursor += 1
  }

  return {
    prefix: prefixes.size === 1 ? [...prefixes][0] : '',
    next: cursor,
    assignments,
  }
}
