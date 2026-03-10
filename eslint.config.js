//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  {
    ignores: [
      'web/.output/**',
      'web/.wrangler/**',
      'bot/.wrangler/**',
      'python/**',
      '*.js',
    ],
  },
  ...tanstackConfig,
]
