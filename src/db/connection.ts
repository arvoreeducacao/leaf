import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { Signer } from '@aws-sdk/rds-signer'
import awsSslProfiles from 'aws-ssl-profiles'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import { drizzle } from 'drizzle-orm/mysql2'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import mysql from 'mysql2/promise'

import * as schema from './schema'

export const MIGRATIONS_FOLDER = 'drizzle/mysql'

export function databaseUrl() {
  const url = process.env.DATABASE_URL?.trim()

  if (!url) {
    throw new Error('DATABASE_URL is not defined')
  }

  return url
}

type DatabaseEnv = Record<string, string | undefined>

export type IamTokenSource = (target: {
  host: string
  port: number
  user: string
  region: string
}) => Promise<string>

const signers = new Map<string, Signer>()

const rdsIamToken: IamTokenSource = ({ host, port, user, region }) => {
  const key = `${host}:${port}:${user}:${region}`
  let signer = signers.get(key)

  if (!signer) {
    signer = new Signer({ hostname: host, port, username: user, region })
    signers.set(key, signer)
  }

  return signer.getAuthToken()
}

function iamRegion(env: DatabaseEnv) {
  const region =
    env.DATABASE_IAM_REGION?.trim() ||
    env.AWS_REGION?.trim() ||
    env.AWS_DEFAULT_REGION?.trim()

  if (!region) {
    throw new Error(
      'DATABASE_IAM_AUTH needs DATABASE_IAM_REGION or AWS_REGION to sign the token',
    )
  }

  return region
}

function authentication(
  target: { host: string; port: number; user: string },
  password: string,
  env: DatabaseEnv,
  tokenSource: IamTokenSource,
): mysql.PoolOptions {
  if (env.DATABASE_IAM_AUTH?.trim() !== 'true') {
    return { password }
  }

  const region = iamRegion(env)

  return {
    ssl: { ca: awsSslProfiles.ca, rejectUnauthorized: true },
    authPlugins: {
      mysql_clear_password: () => async () =>
        Buffer.from(`${await tokenSource({ ...target, region })}\0`),
    },
  }
}

export function connectionOptions(
  url: string,
  env: DatabaseEnv = process.env,
  tokenSource: IamTokenSource = rdsIamToken,
): mysql.PoolOptions {
  const parsed = new URL(url)

  const target = {
    host: parsed.hostname,
    port: parsed.port.length > 0 ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
  }

  return {
    ...target,
    ...authentication(
      target,
      decodeURIComponent(parsed.password),
      env,
      tokenSource,
    ),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
    charset: 'UTF8MB4_UNICODE_CI',
    dateStrings: true,
    timezone: 'Z',
    supportBigNumbers: true,
    connectionLimit: Number(env.DATABASE_POOL_SIZE ?? 10),
    enableKeepAlive: true,
  }
}

export function createPool(url: string, extra: mysql.PoolOptions = {}) {
  return mysql.createPool({ ...connectionOptions(url), ...extra })
}

const BUILD_PHASE = 'phase-production-build'
const LOCK_TIMEOUT_SECONDS = 120

async function withMigrationLock<T>(
  pool: mysql.Pool,
  run: () => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection()

  const [databases] = (await connection.query(
    'select database() as name',
  )) as unknown as [Array<{ name: string }>, unknown]

  const lock = `leaf:migrations:${databases[0]?.name ?? 'default'}`

  const [acquired] = (await connection.query(
    'select get_lock(?, ?) as granted',
    [lock, LOCK_TIMEOUT_SECONDS],
  )) as unknown as [Array<{ granted: number | null }>, unknown]

  if (acquired[0]?.granted !== 1) {
    connection.release()

    throw new Error(`could not acquire the migration lock ${lock}`)
  }

  try {
    return await run()
  } finally {
    await connection.query('do release_lock(?)', [lock])
    connection.release()
  }
}

const MIGRATIONS_TABLE = '__drizzle_migrations'

async function alignRecordedTimestamps(pool: mysql.Pool, folder: string) {
  const [tables] = (await pool.query('show tables like ?', [
    MIGRATIONS_TABLE,
  ])) as unknown as [Array<unknown>, unknown]

  if (tables.length === 0) {
    return
  }

  for (const migration of readMigrationFiles({ migrationsFolder: folder })) {
    await pool.query(
      `update \`${MIGRATIONS_TABLE}\` set created_at = ? where hash = ? and created_at <> ?`,
      [migration.folderMillis, migration.hash, migration.folderMillis],
    )
  }
}

export async function runMigrations(pool: mysql.Pool) {
  const folder = join(process.cwd(), MIGRATIONS_FOLDER)

  if (!existsSync(folder) || process.env.NEXT_PHASE === BUILD_PHASE) {
    return
  }

  await withMigrationLock(pool, async () => {
    await alignRecordedTimestamps(pool, folder)

    await migrate(drizzle(pool, { schema, mode: 'default' }), {
      migrationsFolder: folder,
    })
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
