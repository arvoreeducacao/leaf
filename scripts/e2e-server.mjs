import { spawn } from 'node:child_process'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  loadLocalEnv,
  prepareDatabase,
  sandboxDatabaseUrl,
} from './e2e-database.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sandbox = join(projectRoot, '.e2e')
const port = Number(process.env.E2E_PORT ?? 3100)
const s3Port = Number(process.env.E2E_S3_PORT ?? 4569)
const bucket = 'leaf-e2e'

loadLocalEnv(projectRoot)

const databaseUrl = sandboxDatabaseUrl('LEAF_E2E_DATABASE_URL', 'leaf_e2e')

await prepareDatabase(databaseUrl, projectRoot)

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

const s3 = spawn(process.execPath, [join(projectRoot, 'scripts/dev-s3.mjs')], {
  cwd: sandbox,
  env: { ...process.env, S3_BUCKET: bucket, S3_PORT: String(s3Port) },
  stdio: 'inherit',
})

children.push(s3)

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

for (const child of children) {
  child.on('exit', (code) => shutdown(code ?? 1))
}
