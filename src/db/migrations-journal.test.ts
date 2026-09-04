import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { MIGRATIONS_FOLDER } from './connection'

type JournalEntry = {
  idx: number
  tag: string
  when: number
}

const folder = join(process.cwd(), MIGRATIONS_FOLDER)

const journal = JSON.parse(
  readFileSync(join(folder, 'meta/_journal.json'), 'utf8'),
) as { entries: Array<JournalEntry> }

function describeEntry(entry: JournalEntry) {
  return `${entry.tag} (${new Date(entry.when).toISOString()})`
}

describe('journal de migrações', () => {
  it('carimba cada migração depois da anterior', () => {
    const outOfOrder = journal.entries.flatMap((entry, index) => {
      const previous = journal.entries[index - 1]

      if (previous === undefined || entry.when > previous.when) {
        return []
      }

      return [
        `${describeEntry(entry)} não vem depois de ${describeEntry(previous)}`,
      ]
    })

    expect(outOfOrder).toEqual([])
  })

  it('não carimba migração no futuro', () => {
    const now = Date.now()

    const ahead = journal.entries
      .filter((entry) => entry.when > now)
      .map(describeEntry)

    expect(ahead).toEqual([])
  })

  it('tem um arquivo para cada entrada e uma entrada para cada arquivo', () => {
    const files = readdirSync(folder)
      .filter((name) => name.endsWith('.sql'))
      .map((name) => name.replace(/\.sql$/, ''))
      .sort()

    const tags = journal.entries.map((entry) => entry.tag).sort()

    expect(tags).toEqual(files)
  })
})
