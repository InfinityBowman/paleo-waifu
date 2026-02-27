import { createFileRoute } from '@tanstack/react-router'
import { and, eq } from 'drizzle-orm'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@/lib/db/client'
import { createAuth } from '@/lib/auth'
import {
  claimDaily,
  deductFossils,
  executePullBatch,
  getFossils,
  refundFossils,
} from '@/lib/gacha'
import { banner } from '@/lib/db/schema'
import {
  MULTI_PULL_COUNT,
  PULL_COST_MULTI,
  PULL_COST_SINGLE,
} from '@/lib/types'
import { jsonResponse } from '@/lib/utils'

export const Route = createFileRoute('/api/gacha')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfEnv = getCfEnv()
        const auth = await createAuth(cfEnv)
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }

        const body = (await request.json()) as {
          action: string
          bannerId?: string
        }
        const db = await createDb(cfEnv.DB)

        // Daily claim
        if (body.action === 'claim_daily') {
          const result = await claimDaily(db, session.user.id)
          return jsonResponse(result)
        }

        // Pull
        if (body.action === 'pull' || body.action === 'pull_multi') {
          const bannerId = body.bannerId
          if (!bannerId) {
            return jsonResponse({ error: 'bannerId required' }, 400)
          }

          // Validate banner exists and is active, fetch rateUpId for pulls
          const bannerRow = await db
            .select({ id: banner.id, rateUpId: banner.rateUpId })
            .from(banner)
            .where(and(eq(banner.id, bannerId), eq(banner.isActive, true)))
            .get()

          if (!bannerRow) {
            return jsonResponse(
              { error: 'Banner not found or inactive' },
              400,
            )
          }

          const isMulti = body.action === 'pull_multi'
          const cost = isMulti ? PULL_COST_MULTI : PULL_COST_SINGLE
          const pullCount = isMulti ? MULTI_PULL_COUNT : 1

          // Deduct currency
          const success = await deductFossils(db, session.user.id, cost)
          if (!success) {
            const fossils = await getFossils(db, session.user.id)
            return jsonResponse({ error: 'Insufficient fossils', fossils }, 402)
          }

          // Execute batched pulls — pity + creature inserts are atomic,
          // so on failure nothing is written and we only need to refund fossils
          try {
            const results = await executePullBatch(
              db,
              session.user.id,
              bannerId,
              bannerRow.rateUpId,
              pullCount,
            )
            const fossils = await getFossils(db, session.user.id)
            return jsonResponse({ results, fossils })
          } catch {
            await refundFossils(db, session.user.id, cost)
            const fossils = await getFossils(db, session.user.id)
            return jsonResponse(
              { error: 'Pull failed, fossils refunded', fossils },
              500,
            )
          }
        }

        return jsonResponse({ error: 'Unknown action' }, 400)
      },
    },
  },
})
