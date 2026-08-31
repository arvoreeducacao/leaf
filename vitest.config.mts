import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const envFile = fileURLToPath(new URL('./.env.local', import.meta.url))

if (existsSync(envFile)) {
  process.loadEnvFile(envFile)
}

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    maxWorkers: 6,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      LEAF_TEST_DATABASE_URL: process.env.LEAF_TEST_DATABASE_URL ?? '',
    },
  },
})
