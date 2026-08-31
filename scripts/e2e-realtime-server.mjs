import { spawn } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  loadLocalEnv,
  resetDatabase,
  sandboxDatabaseUrl,
} from './e2e-database.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sandbox = join(projectRoot, '.e2e-realtime')
const port = Number(process.env.E2E_REALTIME_APP_PORT ?? 3200)
const wsPort = Number(process.env.E2E_REALTIME_WS_PORT ?? 1235)
const s3Port = Number(process.env.E2E_S3_PORT ?? 4569)
const secret = 'leaf-e2e-realtime'
const bucket = 'leaf-e2e'

loadLocalEnv(projectRoot)

const databaseUrl = sandboxDatabaseUrl(
  'LEAF_E2E_REALTIME_DATABASE_URL',
  'leaf_e2e_realtime',
)

await resetDatabase(databaseUrl)

rmSync(sandbox, { force: true, recursive: true })
mkdirSync(join(sandbox, 'data'), { recursive: true })
cpSync(join(projectRoot, 'drizzle'), join(sandbox, 'drizzle'), {
  recursive: true,
})

const children = []

function shutdown(code) {
  for (const child of children) {
    child.kill('SIGTERM')
  }

  process.exit(code)
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => shutdown(0))
}

const next = spawn(
  process.execPath,
  [
    join(projectRoot, 'node_modules/next/dist/bin/next'),
    'start',
    projectRoot,
    '--port',
    String(port),
  ],
  {
    cwd: sandbox,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      DATABASE_URL: databaseUrl,
      LEAF_DIST_DIR: process.env.LEAF_DIST_DIR ?? '.next-e2e',
      BETTER_AUTH_SECRET:
        process.env.E2E_AUTH_SECRET ?? 'leaf-e2e-secret-nao-use-em-producao',
      BETTER_AUTH_URL: `http://127.0.0.1:${port}`,
      LEAF_REALTIME: '1',
      LEAF_REALTIME_PORT: String(wsPort),
      LEAF_REALTIME_URL: '',
      LEAF_REALTIME_SECRET: secret,
      S3_ENDPOINT: `http://127.0.0.1:${s3Port}`,
      S3_BUCKET: bucket,
      S3_ACCESS_KEY_ID: 'S3RVER',
      S3_SECRET_ACCESS_KEY: 'S3RVER',
      S3_REGION: 'us-east-1',
    },
    stdio: 'inherit',
  },
)

children.push(next)

const realtime = spawn(
  process.execPath,
  [join(projectRoot, 'scripts/dev-realtime.mjs')],
  {
    cwd: sandbox,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      LEAF_REALTIME: '1',
      LEAF_REALTIME_PORT: String(wsPort),
      LEAF_REALTIME_HOST: '127.0.0.1',
      LEAF_REALTIME_SECRET: secret,
      LEAF_REALTIME_PERSIST_MS: '500',
      LEAF_REALTIME_IDLE_MS: '1000',
      LEAF_APP_URL: `http://127.0.0.1:${port}`,
    },
    stdio: 'inherit',
  },
)

children.push(realtime)

for (const child of children) {
  child.on('exit', (code) => shutdown(code ?? 1))
}
