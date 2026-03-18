import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { createDb } from '@paleo-waifu/shared/db/client'
import { getCfEnv } from '@/lib/env'
import { createAuth } from '@/lib/auth'
import { claimDaily, fossils, pull } from '@/lib/gacha'
import { checkCsrfOrigin, jsonResponse, toCdnUrl } from '@/lib/utils'

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
      POST: async ({ request }) => {
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
        const parsed = GachaBody.safeParse(rawBody)
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }
        const body = parsed.data
        const db = await createDb(cfEnv.DB)

        // Daily claim
        if (body.action === 'claim_daily') {
          await fossils.ensure(db, session.user.id)
          const result = await claimDaily(db, session.user.id)
          return jsonResponse(result)
        }

        // Pull
        await fossils.ensure(db, session.user.id)
        const outcome = await pull(db, session.user.id, {
          mode: body.action === 'pull_multi' ? 'multi' : 'single',
          bannerId: body.bannerId,
          transformImageUrl: toCdnUrl,
        })

        if (!outcome.ok) {
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

        return jsonResponse({
          results: outcome.results,
          fossils: outcome.fossils,
        })
      },
    },
  },
})
