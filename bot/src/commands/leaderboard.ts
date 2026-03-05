import { asc, count, desc, eq, sql } from 'drizzle-orm'
import {
  creature,
  user,
  userCreature,
  userXp,
} from '@paleo-waifu/shared/db/schema'
import { immediateResponse } from '../lib/discord'
import { leaderboardCollectionEmbed, leaderboardXpEmbed } from '../lib/embeds'
import type { Database } from '@paleo-waifu/shared/db/client'

/** /leaderboard-xp — Top 10 players by XP level (immediate, ephemeral) */
export async function handleLeaderboardXp(db: Database): Promise<Response> {
  const rows = await db
    .select({
      name: user.name,
      xp: userXp.xp,
      level: userXp.level,
    })
    .from(userXp)
    .innerJoin(user, eq(userXp.userId, user.id))
    .orderBy(desc(userXp.level), desc(userXp.xp))
    .limit(10)

  const embed = leaderboardXpEmbed(rows)
  return immediateResponse('', { embeds: [embed] })
}

/** /leaderboard-collection — Top 10 players by species collected (immediate, ephemeral) */
export async function handleLeaderboardCollection(
  db: Database,
): Promise<Response> {
  const [collectionRows, totalSpeciesRow] = await Promise.all([
    db
      .select({
        name: user.name,
        uniqueSpecies:
          sql<number>`count(distinct ${userCreature.creatureId})`.as(
            'unique_species',
          ),
      })
      .from(userCreature)
      .innerJoin(user, eq(userCreature.userId, user.id))
      .groupBy(userCreature.userId)
      .orderBy(
        desc(sql`count(distinct ${userCreature.creatureId})`),
        asc(user.id),
      )
      .limit(10),
    db.select({ count: count() }).from(creature).get(),
  ])

  const totalSpecies = totalSpeciesRow?.count ?? 0
  const embed = leaderboardCollectionEmbed(collectionRows, totalSpecies)
  return immediateResponse('', { embeds: [embed] })
}
