import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  test: {
    globalSetup: './tests/setup.ts',
    testTimeout: 30_000,
    hookTimeout: 60_000,
    pool: 'forks',
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@/': resolve(import.meta.dirname, '../web/src/'),
    },
  },
})
