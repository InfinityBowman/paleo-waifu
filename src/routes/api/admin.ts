import { createFileRoute } from '@tanstack/react-router'
import { sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@paleo-waifu/shared/db/client'
import { createAuth } from '@/lib/auth'
import { currency } from '@paleo-waifu/shared/db/schema'
import { checkCsrfOrigin, jsonResponse } from '@/lib/utils'

const AdminBody = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('adjust_fossils'),
    userId: z.string().min(1).max(100),
    amount: z.number().int().min(-100000).max(100000),
  }),
  z.object({
    action: z.literal('ban_user'),
    userId: z.string().min(1).max(100),
    banReason: z.string().max(500).optional(),
    banExpiresIn: z.number().int().positive().optional(),
  }),
  z.object({
    action: z.literal('unban_user'),
    userId: z.string().min(1).max(100),
  }),
  z.object({
    action: z.literal('set_role'),
    userId: z.string().min(1).max(100),
    role: z.enum(['user', 'editor', 'admin']),
  }),
])

export const Route = createFileRoute('/api/admin')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const originError = checkCsrfOrigin(request)
        if (originError) return originError

        const cfEnv = getCfEnv()
        const auth = await createAuth(cfEnv)
        const session = await auth.api.getSession({
          headers: request.headers,
        })

        if (!session) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }

        if ((session.user as { role?: string }).role !== 'admin') {
          return jsonResponse({ error: 'Forbidden' }, 403)
        }

        let rawBody: unknown
        try {
          rawBody = await request.json()
        } catch {
          return jsonResponse({ error: 'Invalid JSON' }, 400)
        }

        const parsed = AdminBody.safeParse(rawBody)
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }

        const body = parsed.data
        const db = await createDb(cfEnv.DB)

        if (body.action === 'adjust_fossils') {
          const result = await db
            .insert(currency)
            .values({
              id: nanoid(),
              userId: body.userId,
              fossils: Math.max(0, body.amount),
            })
            .onConflictDoUpdate({
              target: currency.userId,
              set: {
                fossils: sql`max(0, ${currency.fossils} + ${body.amount})`,
                updatedAt: new Date(),
              },
            })
            .returning({ fossils: currency.fossils })

          return jsonResponse({
            success: true,
            fossils: result[0].fossils,
          })
        }

        if (body.action === 'ban_user') {
          await auth.api.banUser({
            headers: request.headers,
            body: {
              userId: body.userId,
              banReason: body.banReason,
              banExpiresIn: body.banExpiresIn,
            },
          })
          return jsonResponse({ success: true })
        }

        if (body.action === 'unban_user') {
          await auth.api.unbanUser({
            headers: request.headers,
            body: { userId: body.userId },
          })
          return jsonResponse({ success: true })
        }

        // body.action === 'set_role'
        await auth.api.setRole({
          headers: request.headers,
          body: { userId: body.userId, role: body.role },
        })
        return jsonResponse({ success: true })
      },
    },
  },
})
