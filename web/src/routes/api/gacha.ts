import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { claimDaily, fossils, pull } from '@/lib/gacha'
import { apiHandler } from '@/lib/api-handler'
import { jsonResponse, toCdnUrl } from '@/lib/utils'

const GachaBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('claim_daily') }),
  z.object({
    action: z.literal('pull'),
    bannerId: z.string().min(1).max(50),
  }),
  z.object({
    action: z.literal('pull_multi'),
    bannerId: z.string().min(1).max(50),
  }),
])

export const Route = createFileRoute('/api/gacha')({
  server: {
    handlers: {
      POST: apiHandler(GachaBody, async ({ db, userId, log }, body) => {
        log.set({ action: body.action })

        if (body.action === 'claim_daily') {
          await fossils.ensure(db, userId)
          const result = await claimDaily(db, userId)
          log.set({ daily: { claimed: result.claimed } })
          return jsonResponse(result)
        }

        log.set({
          banner: body.bannerId,
          mode: body.action === 'pull_multi' ? 'multi' : 'single',
        })
        await fossils.ensure(db, userId)
        const outcome = await pull(db, userId, {
          mode: body.action === 'pull_multi' ? 'multi' : 'single',
          bannerId: body.bannerId,
          transformImageUrl: toCdnUrl,
        })

        if (!outcome.ok) {
          log.set({ outcome: { ok: false, reason: outcome.reason } })
          if (outcome.reason === 'insufficient_fossils')
            return jsonResponse(
              { error: 'Insufficient fossils', fossils: outcome.fossils },
              402,
            )
          if (outcome.reason === 'banner_not_found')
            return jsonResponse({ error: 'Banner not found or inactive' }, 400)
          return jsonResponse(
            {
              error: 'Pull failed, fossils refunded',
              fossils: outcome.fossils,
            },
            500,
          )
        }

        log.set({
          outcome: {
            ok: true,
            pulls: outcome.results.length,
            fossils: outcome.fossils,
          },
        })
        return jsonResponse({
          results: outcome.results,
          fossils: outcome.fossils,
        })
      }),
    },
  },
})
