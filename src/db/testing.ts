import { getTableName, is } from 'drizzle-orm'
import { MySqlTable } from 'drizzle-orm/mysql-core'
import type mysql from 'mysql2/promise'

import { connect, createPool, runMigrations } from './connection'
import * as schema from './schema'

const SEARCH_INDEX_TABLE = 'documents_fts'

export function testDatabaseUrl(): string {
  const base = process.env.LEAF_TEST_DATABASE_URL?.trim()

  if (!base) {
    throw new Error('LEAF_TEST_DATABASE_URL is not defined')
  }

  const worker = process.env.VITEST_POOL_ID ?? '1'
  const url = new URL(base)

  url.pathname = `/${url.pathname.replace(/^\//, '')}_${worker}`

  return url.toString()
}

function tableNames(): Array<string> {
  const names = Object.values(schema)
    .filter((value) => is(value, MySqlTable))
    .map((value) => getTableName(value as MySqlTable))

  return [...names, SEARCH_INDEX_TABLE]
}

const globalForTests = globalThis as unknown as {
  leafTestPool?: mysql.Pool
  leafTestReady?: Promise<void>
}

function pool() {
  if (!globalForTests.leafTestPool) {
    globalForTests.leafTestPool = createPool(testDatabaseUrl(), {
      multipleStatements: true,
      connectionLimit: 4,
    })
  }

  return globalForTests.leafTestPool
}

function ready() {
  if (!globalForTests.leafTestReady) {
    globalForTests.leafTestReady = runMigrations(pool())
  }

  return globalForTests.leafTestReady
}

export function createTestDb() {
  return { db: connect(pool(), ready()), schema }
}

export async function resetDatabase() {
  await ready()

  const truncates = tableNames()
    .map((name) => `truncate table \`${name}\`;`)
    .join(' ')

  await pool().query(
    `set foreign_key_checks = 0; ${truncates} set foreign_key_checks = 1;`,
  )
}
