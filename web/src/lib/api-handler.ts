import { createDb } from '@paleo-waifu/shared/db/client'
import { getCfEnv } from './env'
import { createAuth } from './auth'
import { getUserRole } from './auth-server'
import { checkCsrfOrigin, jsonResponse } from './utils'
import type { Database } from '@paleo-waifu/shared/db/client'

import type { z } from 'zod'

export interface AuthedContext {
  db: Database
  userId: string
  user: Record<string, unknown>
  request: Request
  /** The better-auth instance — needed by admin routes for ban/unban/setRole */
  auth: Awaited<ReturnType<typeof createAuth>>
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
    const originError = checkCsrfOrigin(request)
    if (originError) return originError

    const cfEnv = getCfEnv()
    const auth = await createAuth(cfEnv)
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return jsonResponse({ error: 'Invalid JSON' }, 400)
    }
    const parsed = schema.safeParse(rawBody)
    if (!parsed.success) {
      return jsonResponse({ error: 'Invalid request body' }, 400)
    }

    const db = await createDb(cfEnv.DB)
    return handler(
      { db, userId: session.user.id, user: session.user, request, auth },
      parsed.data as z.infer<T>,
    )
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
