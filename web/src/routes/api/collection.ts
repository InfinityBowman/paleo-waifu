import { createFileRoute } from '@tanstack/react-router'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { userCreature } from '@paleo-waifu/shared/db/schema'
import { apiHandler } from '@/lib/api-handler'
import { jsonResponse } from '@/lib/utils'

const FavoriteBody = z.object({
  action: z.literal('toggleFavorite'),
  userCreatureId: z.string().min(1).max(50),
})

export const Route = createFileRoute('/api/collection')({
  server: {
    handlers: {
      POST: apiHandler(FavoriteBody, async ({ db, userId }, body) => {
        const [row] = await db
          .select({ isFavorite: userCreature.isFavorite })
          .from(userCreature)
          .where(
            and(
              eq(userCreature.id, body.userCreatureId),
              eq(userCreature.userId, userId),
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
      }),
    },
  },
})
