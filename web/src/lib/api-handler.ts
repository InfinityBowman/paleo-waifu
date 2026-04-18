import { createDb } from '@paleo-waifu/shared/db/client'
import {
  createWorkersLogger,
  ensureWorkersLog,
  identifyUser,
} from '@paleo-waifu/shared/logger'
import { getCfEnv } from './env'
import { createAuth } from './auth'
import { getUserRole } from './auth-server'
import { checkCsrfOrigin, jsonResponse } from './utils'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { RequestLogger } from '@paleo-waifu/shared/logger'

import type { z } from 'zod'

export interface AuthedContext {
  db: Database
  userId: string
  user: Record<string, unknown>
  request: Request
  /** The better-auth instance — needed by admin routes for ban/unban/setRole */
  auth: Awaited<ReturnType<typeof createAuth>>
  /** Request-scoped wide-event logger. Set context as work progresses; it's emitted automatically. */
  log: RequestLogger
}

/**
 * Create an authenticated POST handler with CSRF check, session validation,
 * Zod body parsing, and a shared DB connection.
 *
 * Eliminates the ~15-line boilerplate repeated across every API route.
 */
export function apiHandler<T extends z.ZodType>(
  schema: T,
  handler: (ctx: AuthedContext, body: z.infer<T>) => Promise<Response>,
): (args: { request: Request }) => Promise<Response> {
  return async ({ request }) => {
    const cfEnv = getCfEnv()
    ensureWorkersLog({
      service: 'web',
      environment: (cfEnv as { ENVIRONMENT?: string }).ENVIRONMENT,
    })
    const log = createWorkersLogger(request)
    try {
      const originError = checkCsrfOrigin(request)
      if (originError) {
        log.emit({ status: originError.status, reason: 'csrf_blocked' })
        return originError
      }

      const auth = await createAuth(cfEnv)
      const session = await auth.api.getSession({ headers: request.headers })
      if (!session) {
        log.emit({ status: 401, reason: 'unauthenticated' })
        return jsonResponse({ error: 'Unauthorized' }, 401)
      }
      identifyUser(log, session, { maskEmail: true })

      let rawBody: unknown
      try {
        rawBody = await request.json()
      } catch {
        log.emit({ status: 400, reason: 'invalid_json' })
        return jsonResponse({ error: 'Invalid JSON' }, 400)
      }
      const parsed = schema.safeParse(rawBody)
      if (!parsed.success) {
        log.emit({
          status: 400,
          reason: 'validation_failed',
          issues: parsed.error.issues.map((i) => ({
            path: i.path.join('.'),
            code: i.code,
          })),
        })
        return jsonResponse({ error: 'Invalid request body' }, 400)
      }

      const db = await createDb(cfEnv.DB)
      const response = await handler(
        {
          db,
          userId: session.user.id,
          user: session.user,
          request,
          auth,
          log,
        },
        parsed.data as z.infer<T>,
      )
      log.emit({ status: response.status })
      return response
    } catch (err) {
      log.error(err as Error)
      log.emit({ status: 500, reason: 'unhandled_exception' })
      throw err
    }
  }
}

/**
 * Same as `apiHandler` but requires admin role.
 */
export function adminHandler<T extends z.ZodType>(
  schema: T,
  handler: (ctx: AuthedContext, body: z.infer<T>) => Promise<Response>,
): (args: { request: Request }) => Promise<Response> {
  return apiHandler(schema, async (ctx, body) => {
    if (getUserRole(ctx.user) !== 'admin') {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }
    return handler(ctx, body)
  })
}
