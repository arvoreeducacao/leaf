import type { DatabaseProperty } from '@/db/schema'

import { type SelectOption, colorForIndex, parseOptions } from './values'

export type Person = Readonly<{
  id: string
  name: string
  email: string
}>

export const MAX_PEOPLE_VALUES = 20

export function personOptions(
  people: ReadonlyArray<Person>,
): Array<SelectOption> {
  return people.map((person, index) => ({
    id: person.id,
    name: person.name,
    color: colorForIndex(index),
  }))
}

export function optionsFor(
  property: Pick<DatabaseProperty, 'type' | 'options'>,
  people: ReadonlyArray<Person>,
): Array<SelectOption> {
  return property.type === 'person'
    ? personOptions(people)
    : parseOptions(property.options)
}

export function localPartOf(email: string): string {
  return email.split('@')[0] ?? ''
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function wordsOf(value: string): Array<string> {
  return fold(value).split(' ').filter(Boolean)
}

export type PersonMatch =
  | Readonly<{ kind: 'matched'; personId: string }>
  | Readonly<{ kind: 'ambiguous'; candidateIds: ReadonlyArray<string> }>
  | Readonly<{ kind: 'unmatched' }>

function candidatesFor(
  text: string,
  people: ReadonlyArray<Person>,
): Array<Person> {
  const needle = fold(text)

  if (needle.length === 0) {
    return []
  }

  const byFullName = people.filter((person) => fold(person.name) === needle)

  if (byFullName.length > 0) {
    return byFullName
  }

  const byEmail = people.filter(
    (person) =>
      fold(person.email) === needle || fold(localPartOf(person.email)) === needle,
  )

  if (byEmail.length > 0) {
    return byEmail
  }

  return people.filter((person) => {
    const parts = [
      ...wordsOf(person.name),
      ...wordsOf(localPartOf(person.email)),
    ]

    return parts.includes(needle)
  })
}

export function matchPerson(
  text: string,
  people: ReadonlyArray<Person>,
): PersonMatch {
  const candidates = candidatesFor(text, people)

  if (candidates.length === 1) {
    return { kind: 'matched', personId: candidates[0].id }
  }

  if (candidates.length > 1) {
    return {
      kind: 'ambiguous',
      candidateIds: candidates.map((person) => person.id),
    }
  }

  return { kind: 'unmatched' }
}

export type ColumnReconciliation = Readonly<{
  resolved: Readonly<Record<string, string>>
  pending: ReadonlyArray<
    Readonly<{ text: string; candidateIds: ReadonlyArray<string> }>
  >
  unmatched: ReadonlyArray<string>
}>

export function reconcileColumn(
  texts: ReadonlyArray<string>,
  people: ReadonlyArray<Person>,
): ColumnReconciliation {
  const resolved: Record<string, string> = {}
  const pending: Array<{ text: string; candidateIds: ReadonlyArray<string> }> =
    []
  const unmatched: Array<string> = []
  const seen = new Set<string>()

  for (const raw of texts) {
    const text = raw.trim()

    if (text.length === 0 || seen.has(text)) {
      continue
    }

    seen.add(text)

    const match = matchPerson(text, people)

    if (match.kind === 'matched') {
      resolved[text] = match.personId
      continue
    }

    if (match.kind === 'ambiguous') {
      pending.push({ text, candidateIds: match.candidateIds })
      continue
    }

    unmatched.push(text)
  }

  return { resolved, pending, unmatched }
}
