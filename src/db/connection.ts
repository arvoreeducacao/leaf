import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import mysql from 'mysql2/promise'

import * as schema from './schema'

export const MIGRATIONS_FOLDER = 'drizzle/mysql'

export function databaseUrl() {
  const url = process.env.DATABASE_URL?.trim()

  if (!url) {
    throw new Error('DATABASE_URL não está definida')
  }

  return url
}

export function connectionOptions(url: string): mysql.PoolOptions {
  const parsed = new URL(url)

  return {
    host: parsed.hostname,
    port: parsed.port.length > 0 ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    charset: 'UTF8MB4_UNICODE_CI',
    dateStrings: true,
    timezone: 'Z',
    supportBigNumbers: true,
    connectionLimit: Number(process.env.DATABASE_POOL_SIZE ?? 10),
    enableKeepAlive: true,
  }
}

export function createPool(url: string, extra: mysql.PoolOptions = {}) {
  return mysql.createPool({ ...connectionOptions(url), ...extra })
}

export async function runMigrations(pool: mysql.Pool) {
  const folder = join(process.cwd(), MIGRATIONS_FOLDER)

  if (!existsSync(folder)) {
    return
  }

  await migrate(drizzle(pool, { schema, mode: 'default' }), {
    migrationsFolder: folder,
  })
}

export function gated<T extends object>(pool: T, ready: Promise<unknown>): T {
  const deferred = new Set(['query', 'execute', 'getConnection'])

  return new Proxy(pool, {
    get(target, property) {
      const value = Reflect.get(target, property)

      if (typeof value !== 'function') {
        return value
      }

      if (deferred.has(String(property))) {
        return async (...args: Array<unknown>) => {
          await ready
          return Reflect.apply(value, target, args)
        }
      }

      return value.bind(target)
    },
  })
}

export function connect(pool: mysql.Pool, ready: Promise<unknown>) {
  return drizzle(gated(pool, ready), { schema, mode: 'default' })
}
