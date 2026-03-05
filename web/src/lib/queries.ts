import { eq, sql } from 'drizzle-orm'
import { userCreature } from '@paleo-waifu/shared/db/schema'
import type { Database } from '@paleo-waifu/shared/db/client'

/** Count unique creature species owned by a user */
export async function countDistinctSpecies(
  db: Database,
  userId: string,
): Promise<number> {
  const result = await db
    .select({
      count: sql<number>`count(distinct ${userCreature.creatureId})`,
    })
    .from(userCreature)
    .where(eq(userCreature.userId, userId))
    .get()
  return result?.count ?? 0
}
