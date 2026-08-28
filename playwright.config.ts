import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.E2E_PORT ?? 3100)

const baseURL = `http://127.0.0.1:${port}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
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
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 780 } },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
