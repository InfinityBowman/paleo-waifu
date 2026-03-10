import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/e2e/**/*.test.ts'],
    globalSetup: './tests/e2e/setup.ts',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@/': resolve(import.meta.dirname, 'src') + '/',
    },
  },
})
