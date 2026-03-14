import { and, eq, inArray } from 'drizzle-orm'
import { tradeOffer, tradeProposal } from '@paleo-waifu/shared/db/schema'
import type { Database } from '@paleo-waifu/shared/db/client'

/**
 * Returns the subset of `creatureIds` that are currently committed to an
 * open trade offer or a pending trade proposal.
 */
export async function getLockedCreatureIds(
  db: Database,
  creatureIds: Array<string>,
): Promise<Set<string>> {
  if (creatureIds.length === 0) return new Set()

  const [offered, proposed] = await Promise.all([
    db
      .select({ id: tradeOffer.offeredCreatureId })
      .from(tradeOffer)
      .where(
        and(
          inArray(tradeOffer.offeredCreatureId, creatureIds),
          eq(tradeOffer.status, 'open'),
        ),
      )
      .all(),
    db
      .select({ id: tradeProposal.proposerCreatureId })
      .from(tradeProposal)
      .where(
        and(
          inArray(tradeProposal.proposerCreatureId, creatureIds),
          eq(tradeProposal.status, 'pending'),
        ),
      )
      .all(),
  ])

  return new Set([...offered.map((r) => r.id), ...proposed.map((r) => r.id)])
}

/**
 * Check if a single creature is in an active trade (offer or proposal).
 */
export async function isCreatureInTrade(
  db: Database,
  creatureId: string,
): Promise<boolean> {
  const [offered, proposed] = await Promise.all([
    db
      .select({ id: tradeOffer.offeredCreatureId })
      .from(tradeOffer)
      .where(
        and(
          eq(tradeOffer.offeredCreatureId, creatureId),
          eq(tradeOffer.status, 'open'),
        ),
      )
      .get(),
    db
      .select({ id: tradeProposal.proposerCreatureId })
      .from(tradeProposal)
      .where(
        and(
          eq(tradeProposal.proposerCreatureId, creatureId),
          eq(tradeProposal.status, 'pending'),
        ),
      )
      .get(),
  ])

  return !!(offered || proposed)
}
