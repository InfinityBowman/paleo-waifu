import { createFileRoute } from '@tanstack/react-router'
import { eq, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { createDb } from '@paleo-waifu/shared/db/client'
import { updatePost } from '@paleo-waifu/shared/db/schema'
import { getCfEnv } from '@/lib/env'
import { createAuth } from '@/lib/auth'
import { getUserRole } from '@/lib/auth-server'
import { checkCsrfOrigin, jsonResponse } from '@/lib/utils'

const UpdateBody = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    title: z.string().min(1).max(200),
    body: z.string().min(1),
    tag: z.enum(['feature', 'balance', 'bugfix', 'event']).nullable(),
    publishedAt: z.number().int(),
  }),
  z.object({
    action: z.literal('update'),
    id: z.string().min(1),
    title: z.string().min(1).max(200),
    body: z.string().min(1),
    tag: z.enum(['feature', 'balance', 'bugfix', 'event']).nullable(),
    publishedAt: z.number().int(),
  }),
  z.object({
    action: z.literal('delete'),
    id: z.string().min(1),
  }),
])

export const Route = createFileRoute('/api/updates')({
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

        if (getUserRole(session.user) !== 'admin') {
          return jsonResponse({ error: 'Forbidden' }, 403)
        }

        let rawBody: unknown
        try {
          rawBody = await request.json()
        } catch {
          return jsonResponse({ error: 'Invalid JSON' }, 400)
        }

        const parsed = UpdateBody.safeParse(rawBody)
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }

        const data = parsed.data
        const db = await createDb(cfEnv.DB)

        if (data.action === 'create') {
          const id = nanoid()
          await db.insert(updatePost).values({
            id,
            title: data.title,
            body: data.body,
            tag: data.tag,
            publishedAt: new Date(data.publishedAt * 1000),
          })
          return jsonResponse({ success: true, id })
        }

        if (data.action === 'update') {
          await db
            .update(updatePost)
            .set({
              title: data.title,
              body: data.body,
              tag: data.tag,
              publishedAt: new Date(data.publishedAt * 1000),
              updatedAt: sql`(unixepoch())`,
            })
            .where(eq(updatePost.id, data.id))
          return jsonResponse({ success: true })
        }

        // data.action === 'delete'
        await db.delete(updatePost).where(eq(updatePost.id, data.id))
        return jsonResponse({ success: true })
      },
    },
  },
})
