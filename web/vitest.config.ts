import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 15_000,
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
})
