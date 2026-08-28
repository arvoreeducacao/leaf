import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'

import * as schema from './schema'

function createDb() {
  const directory = join(process.cwd(), 'data')

  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true })
  }

  const sqlite = new Database(join(directory, 'leaf.db'))
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')

  const instance = drizzle(sqlite, { schema })
  const migrationsFolder = join(process.cwd(), 'drizzle')

  if (existsSync(migrationsFolder)) {
    migrate(instance, { migrationsFolder })
  }

  return instance
}

const globalForDb = globalThis as unknown as {
  leafDb?: ReturnType<typeof createDb>
}

export const db = globalForDb.leafDb ?? createDb()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.leafDb = db
}

export { schema }
