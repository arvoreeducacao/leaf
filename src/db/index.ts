import { connect, createPool, databaseUrl, runMigrations } from './connection'
import * as schema from './schema'

function createDb() {
  const pool = createPool(databaseUrl())
  const ready = runMigrations(pool)

  ready.catch(() => undefined)

  return connect(pool, ready)
}

const globalForDb = globalThis as unknown as {
  leafDb?: ReturnType<typeof createDb>
}

export const db = globalForDb.leafDb ?? createDb()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.leafDb = db
}

export { schema }
