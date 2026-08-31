import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 3100)
const realtimePort = Number(process.env.E2E_REALTIME_APP_PORT ?? 3200)
const restrictedPort = Number(process.env.E2E_RESTRICTED_PORT ?? 3300)
const ssoPort = Number(process.env.E2E_SSO_PORT ?? 3400)

const baseURL = `http://127.0.0.1:${port}`
const realtimeBaseURL = `http://127.0.0.1:${realtimePort}`
const restrictedBaseURL = `http://127.0.0.1:${restrictedPort}`
const ssoBaseURL = `http://127.0.0.1:${ssoPort}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: Number(process.env.E2E_WORKERS ?? 1),
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? 'list' : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    locale: 'pt-BR',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } },
      testIgnore: /(mobile|realtime|restricted-auth|sso-auth)\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 780 } },
      testMatch: /mobile\.spec\.ts/,
    },
    {
      name: 'realtime',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        baseURL: realtimeBaseURL,
      },
      testMatch: /realtime\.spec\.ts/,
    },
    {
      name: 'restricted',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        baseURL: restrictedBaseURL,
      },
      testMatch: /restricted-auth\.spec\.ts/,
    },
    {
      name: 'sso',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 900 },
        baseURL: ssoBaseURL,
      },
      testMatch: /sso-auth\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'node scripts/e2e-server.mjs',
      url: baseURL,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'node scripts/e2e-realtime-server.mjs',
      url: realtimeBaseURL,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'node scripts/e2e-restricted-server.mjs',
      url: restrictedBaseURL,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      command: 'node scripts/e2e-sso-server.mjs',
      url: ssoBaseURL,
      reuseExistingServer: false,
      timeout: 180_000,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  ],
})
