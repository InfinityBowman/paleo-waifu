import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, count, eq } from 'drizzle-orm'
import { createDb } from '@paleo-waifu/shared/db/client'
import {
  battleChallenge,
  currency,
  tradeOffer,
  tradeProposal,
} from '@paleo-waifu/shared/db/schema'
import { createAuth } from './auth'
import { getCfEnv } from './env'

export interface BadgeData {
  canClaimDaily: boolean
  incomingProposals: number
  incomingChallenges: number
}

export const getBadges = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BadgeData | null> => {
    const cfEnv = getCfEnv()
    const request = getRequest()
    const auth = await createAuth(cfEnv)
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return null

    const db = await createDb(cfEnv.DB)
    const userId = session.user.id

    const [currencyRow, proposalCount, challengeCount] = await Promise.all([
      db
        .select({ lastDailyClaim: currency.lastDailyClaim })
        .from(currency)
        .where(eq(currency.userId, userId))
        .get(),
      db
        .select({ count: count() })
        .from(tradeProposal)
        .innerJoin(tradeOffer, eq(tradeOffer.id, tradeProposal.tradeId))
        .where(
          and(
            eq(tradeOffer.offererId, userId),
            eq(tradeOffer.status, 'open'),
            eq(tradeProposal.status, 'pending'),
          ),
        )
        .get(),
      db
        .select({ count: count() })
        .from(battleChallenge)
        .where(
          and(
            eq(battleChallenge.defenderId, userId),
            eq(battleChallenge.status, 'pending'),
          ),
        )
        .get(),
    ])

    const now = Math.floor(Date.now() / 1000)
    const startOfDay = now - (now % 86400)
    const lastClaim = currencyRow?.lastDailyClaim
      ? Math.floor(currencyRow.lastDailyClaim.getTime() / 1000)
      : 0

    return {
      canClaimDaily: lastClaim < startOfDay,
      incomingProposals: proposalCount?.count ?? 0,
      incomingChallenges: challengeCount?.count ?? 0,
    }
  },
)
