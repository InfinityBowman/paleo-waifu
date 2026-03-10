import { createFileRoute } from '@tanstack/react-router'

const notFound = () => new Response('Not Found', { status: 404 })

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/dev/tools')({
  server: {
    handlers: {
      POST: import.meta.env.DEV
        ? async ({ request }) => {
            const isDev =
              typeof process !== 'undefined' &&
              process.env.NODE_ENV === 'development'
            if (!isDev) return notFound()

            const { eq, sql } = await import('drizzle-orm')
            const { nanoid } = await import('nanoid')
            const { createDb } = await import('@paleo-waifu/shared/db/client')
            const { getCfEnv } = await import('@/lib/env')
            const { creature, currency, userCreature, battleRating, user } =
              await import('@paleo-waifu/shared/db/schema')
            const { grantFossils, ensureUserCurrency } =
              await import('@/lib/gacha')

            const body = await request.json()
            const { action, userId } = body as {
              action: string
              userId: string
            }
            if (!userId || !action)
              return json({ error: 'Missing fields' }, 400)

            const cfEnv = getCfEnv()
            const db = await createDb(cfEnv.DB)

            const exists = await db
              .select({ id: user.id })
              .from(user)
              .where(eq(user.id, userId))
              .get()
            if (!exists) return json({ error: 'User not found' }, 404)

            if (action === 'add_fossils') {
              const { amount } = body as { amount: number }
              if (!amount || amount < 1 || amount > 100000)
                return json({ error: 'Invalid amount' }, 400)
              await ensureUserCurrency(db, userId)
              await grantFossils(db, userId, amount)
              return json({ success: true })
            }

            if (action === 'force_pull') {
              const { rarity } = body as { rarity: string }
              const row = await db
                .select({ id: creature.id, name: creature.name })
                .from(creature)
                .where(eq(creature.rarity, rarity))
                .orderBy(sql`RANDOM()`)
                .limit(1)
                .get()
              if (!row)
                return json({ error: 'No creatures of that rarity' }, 400)

              await db.insert(userCreature).values({
                id: nanoid(),
                userId,
                creatureId: row.id,
                bannerId: null,
                pulledAt: sql`(unixepoch())`,
              })
              return json({ success: true, name: row.name })
            }

            if (action === 'reset_daily') {
              await ensureUserCurrency(db, userId)
              await db
                .update(currency)
                .set({ lastDailyClaim: null })
                .where(eq(currency.userId, userId))
              return json({ success: true })
            }

            if (action === 'reset_arena') {
              await db
                .insert(battleRating)
                .values({ userId, arenaAttacksToday: 0 })
                .onConflictDoUpdate({
                  target: battleRating.userId,
                  set: { arenaAttacksToday: 0 },
                })
              return json({ success: true })
            }

            if (action === 'set_rating') {
              const { rating } = body as { rating: number }
              await db
                .insert(battleRating)
                .values({ userId, rating })
                .onConflictDoUpdate({
                  target: battleRating.userId,
                  set: { rating },
                })
              return json({ success: true })
            }

            return json({ error: 'Unknown action' }, 400)
          }
        : notFound,
    },
  },
})
