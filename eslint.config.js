//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
  { ignores: ['.output/**', '.wrangler/**', 'python/**', '*.js'] },
  ...tanstackConfig,
]
