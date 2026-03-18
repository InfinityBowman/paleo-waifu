import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/browser',
  timeout: 30_000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: process.env.__TEST_WORKER_URL ?? 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  // Reuse the same global setup as vitest e2e — starts vite dev server + applies migrations
  globalSetup: './tests/browser/global-setup.ts',
})
