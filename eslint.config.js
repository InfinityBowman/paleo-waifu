//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: [
      'web/.output/**',
      'web/.wrangler/**',
      'bot/.wrangler/**',
      'python/**',
      'reference/**',
      'tools/**',
      '*.js',
    ],
  },
  ...tanstackConfig,
  {
    files: ['web/tests/e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
    },
  },
]
