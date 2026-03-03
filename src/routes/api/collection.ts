import { createFileRoute } from '@tanstack/react-router'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@/lib/db/client'
import { createAuth } from '@/lib/auth'
import { userCreature } from '@/lib/db/schema'
import { checkCsrfOrigin, jsonResponse } from '@/lib/utils'

const FavoriteBody = z.object({
  action: z.literal('toggleFavorite'),
  userCreatureId: z.string().min(1).max(50),
})

export const Route = createFileRoute('/api/collection')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const originError = checkCsrfOrigin(request)
        if (originError) return originError

        const cfEnv = getCfEnv()
        const auth = await createAuth(cfEnv)
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }

        let body: z.infer<typeof FavoriteBody>
        try {
          body = FavoriteBody.parse(await request.json())
        } catch {
          return jsonResponse({ error: 'Invalid request' }, 400)
        }

        const db = await createDb(cfEnv.DB)

        const [row] = await db
          .select({ isFavorite: userCreature.isFavorite })
          .from(userCreature)
          .where(
            and(
              eq(userCreature.id, body.userCreatureId),
              eq(userCreature.userId, session.user.id),
            ),
          )
          .limit(1)

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- row can be undefined if no match
        if (!row) {
          return jsonResponse({ error: 'Creature not found' }, 404)
        }

        await db
          .update(userCreature)
          .set({ isFavorite: !row.isFavorite })
          .where(eq(userCreature.id, body.userCreatureId))

        return jsonResponse({ isFavorite: !row.isFavorite })
      },
    },
  },
})
