import { drizzle } from 'drizzle-orm/d1'
import * as schema from './vendor/schema'
import { D1DatabaseShim } from './d1-http-shim'
import type { EditorEnv } from './env'

export type EditorDatabase = ReturnType<typeof createEditorDb>

export function createEditorDb(env: EditorEnv) {
  const client = new D1DatabaseShim({
    accountId: env.CF_ACCOUNT_ID,
    databaseId: env.CF_D1_DATABASE_ID,
    token: env.CF_API_TOKEN,
  })

  // Cast shim to D1Database — implements the same runtime interface
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return drizzle(client as any, { schema })
}

export { schema }
