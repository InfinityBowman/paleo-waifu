/**
 * Shared logger setup for Cloudflare Workers across the paleo-waifu monorepo.
 *
 * Wraps evlog's Workers integration with our standard config:
 *   - stringify: false so CF Workers Logs receives raw objects (queryable by field)
 *   - pretty: false in production, on in dev (auto-detected via env)
 *   - redact: built-ins on in prod for PII safety
 *
 * Usage in a Worker entry:
 *   import { initWorkersLog, createWorkersLogger } from '@paleo-waifu/shared/logger'
 *
 *   initWorkersLog({ service: 'web', environment: 'production' })
 *
 *   export default {
 *     async fetch(request, env, ctx) {
 *       const log = createWorkersLogger(request)
 *       log.set({ user: { id: '...' } })
 *       try {
 *         const res = await handle(request, env, ctx, log)
 *         log.emit({ status: res.status })
 *         return res
 *       } catch (err) {
 *         log.error(err as Error)
 *         log.emit({ status: 500 })
 *         throw err
 *       }
 *     },
 *   }
 */
import { initWorkersLogger } from 'evlog/workers'

interface InitOptions {
  service: string
  environment?: string
  enabled?: boolean
}

let initialized = false

/**
 * Idempotent. Safe to call from every Worker fetch handler — first call wins,
 * subsequent calls are no-ops. This shape is needed because some entry layouts
 * (e.g. TanStack Start) don't reliably evaluate user module-scope code before
 * the first route emit, so a "call once at top level" init can be missed and
 * evlog falls back to its defaults (`service: 'app'`, `environment: 'development'`).
 */
export function ensureWorkersLog({
  service,
  environment,
  enabled = true,
}: InitOptions): void {
  if (initialized) return
  initialized = true
  const env = environment ?? 'production'
  const isDev = env !== 'production'
  initWorkersLogger({
    enabled,
    env: { service, environment: env },
    pretty: isDev,
    stringify: false,
    redact: !isDev,
  })
}

export { createWorkersLogger } from 'evlog/workers'
export { createError, log } from 'evlog'
export { identifyUser, maskEmail } from 'evlog/better-auth'
export type { RequestLogger } from 'evlog'
