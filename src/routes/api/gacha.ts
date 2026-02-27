import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { and, eq, inArray } from 'drizzle-orm'
import { createDb } from '@/lib/db/client'
import { createAuth } from '@/lib/auth'
import {
  claimDaily,
  deductFossils,
  executePull,
  getFossils,
  refundFossils,
} from '@/lib/gacha'
import { banner, pityCounter, userCreature } from '@/lib/db/schema'
import {
  MULTI_PULL_COUNT,
  PULL_COST_MULTI,
  PULL_COST_SINGLE,
} from '@/lib/types'

export const Route = createFileRoute('/api/gacha')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfEnv = env as unknown as Env
        const auth = createAuth(cfEnv)
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const body = (await request.json()) as {
          action: string
          bannerId?: string
        }
        const db = createDb(cfEnv.DB)

        // Daily claim
        if (body.action === 'claim_daily') {
          const result = await claimDaily(db, session.user.id)
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Pull
        if (body.action === 'pull' || body.action === 'pull_multi') {
          const bannerId = body.bannerId
          if (!bannerId) {
            return new Response(
              JSON.stringify({ error: 'bannerId required' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          // Validate banner exists and is active before deducting fossils
          const bannerRow = await db
            .select({ id: banner.id })
            .from(banner)
            .where(and(eq(banner.id, bannerId), eq(banner.isActive, true)))
            .get()

          if (!bannerRow) {
            return new Response(
              JSON.stringify({ error: 'Banner not found or inactive' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          const isMulti = body.action === 'pull_multi'
          const cost = isMulti ? PULL_COST_MULTI : PULL_COST_SINGLE
          const pullCount = isMulti ? MULTI_PULL_COUNT : 1

          // Deduct currency
          const success = await deductFossils(db, session.user.id, cost)
          if (!success) {
            const fossils = await getFossils(db, session.user.id)
            return new Response(
              JSON.stringify({ error: 'Insufficient fossils', fossils }),
              { status: 402, headers: { 'Content-Type': 'application/json' } },
            )
          }

          // Snapshot pity state before pulls so we can restore on failure
          const pityBefore = await db
            .select()
            .from(pityCounter)
            .where(
              and(
                eq(pityCounter.userId, session.user.id),
                eq(pityCounter.bannerId, bannerId),
              ),
            )
            .get()

          // Execute pulls — clean up inserted creatures, refund, and restore pity on failure
          const results = []
          try {
            for (let i = 0; i < pullCount; i++) {
              const result = await executePull(db, session.user.id, bannerId)
              results.push(result)
            }
          } catch (err) {
            // Delete any creatures already inserted during this batch
            const insertedIds = results.map((r) => r.userCreatureId)
            if (insertedIds.length > 0) {
              await db
                .delete(userCreature)
                .where(inArray(userCreature.id, insertedIds))
            }
            // Restore pity counter to pre-pull state
            if (pityBefore) {
              await db
                .update(pityCounter)
                .set({
                  pullsSinceRare: pityBefore.pullsSinceRare,
                  pullsSinceLegendary: pityBefore.pullsSinceLegendary,
                  totalPulls: pityBefore.totalPulls,
                })
                .where(eq(pityCounter.id, pityBefore.id))
            }
            await refundFossils(db, session.user.id, cost)
            const fossils = await getFossils(db, session.user.id)
            return new Response(
              JSON.stringify({
                error: 'Pull failed, fossils refunded',
                fossils,
              }),
              { status: 500, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const fossils = await getFossils(db, session.user.id)

          return new Response(JSON.stringify({ results, fossils }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
