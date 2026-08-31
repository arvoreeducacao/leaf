import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import mysql from 'mysql2/promise'

export function loadLocalEnv(projectRoot) {
  const file = join(projectRoot, '.env.local')

  if (existsSync(file)) {
    process.loadEnvFile(file)
  }
}

export function sandboxDatabaseUrl(key, database) {
  const explicit = process.env[key]?.trim()

  if (explicit) {
    return explicit
  }

  const base = process.env.DATABASE_URL?.trim()

  if (!base) {
    throw new Error(`defina ${key} ou DATABASE_URL no .env.local`)
  }

  const url = new URL(base)
  url.pathname = `/${database}`

  return url.toString()
}

export async function prepareDatabase(url, projectRoot) {
  const parsed = new URL(url)
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''))

  const options = {
    host: parsed.hostname,
    port: parsed.port.length > 0 ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    connectTimeout: 20_000,
  }

  const connection = await mysql.createConnection({
    ...options,
    multipleStatements: true,
  })

  const [tables] = await connection.query(
    'select table_name as name from information_schema.tables where table_schema = ?',
    [database],
  )

  if (tables.length > 0) {
    const list = tables.map((table) => `\`${table.name}\``).join(', ')

    await connection.query(
      `set foreign_key_checks = 0; drop table ${list}; set foreign_key_checks = 1;`,
    )
  }

  await connection.end()

  const pool = mysql.createPool({ ...options, dateStrings: true })

  await migrate(drizzle(pool), {
    migrationsFolder: join(projectRoot, 'drizzle/mysql'),
  })

  await pool.end()
}
