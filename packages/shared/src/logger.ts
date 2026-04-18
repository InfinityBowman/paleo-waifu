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

export function initWorkersLog({
  service,
  environment = 'production',
  enabled = true,
}: InitOptions): void {
  const isDev = environment !== 'production'
  initWorkersLogger({
    enabled,
    env: { service, environment },
    pretty: isDev,
    stringify: false,
    redact: !isDev,
  })
}

export { createWorkersLogger } from 'evlog/workers'
export { createError, log } from 'evlog'
export { identifyUser, maskEmail } from 'evlog/better-auth'
export type { RequestLogger } from 'evlog'
