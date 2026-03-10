import { desc, eq, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { battleLog, user } from '@paleo-waifu/shared/db/schema'
import { ephemeralResponse } from '../lib/discord'
import {
  ensureBattleRating,
  getTierEmoji,
  getTierLabel,
} from '../lib/battle-helpers'
import { APP_URL } from '../lib/constants'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'
import type { Embed } from '../lib/discord'

/** /battles — Show rating and recent battle history (ephemeral) */
export async function handleBattles(
  db: Database,
  appUser: AppUser,
): Promise<Response> {
  const attacker = alias(user, 'attacker_user')
  const defender = alias(user, 'defender_user')

  const battles = await db
    .select({
      id: battleLog.id,
      mode: battleLog.mode,
      attackerId: battleLog.attackerId,
      defenderId: battleLog.defenderId,
      winnerId: battleLog.winnerId,
      attackerName: attacker.name,
      defenderName: defender.name,
      ratingChange: battleLog.ratingChange,
      createdAt: battleLog.createdAt,
    })
    .from(battleLog)
    .innerJoin(attacker, eq(attacker.id, battleLog.attackerId))
    .innerJoin(defender, eq(defender.id, battleLog.defenderId))
    .where(
      or(
        eq(battleLog.attackerId, appUser.id),
        eq(battleLog.defenderId, appUser.id),
      ),
    )
    .orderBy(desc(battleLog.createdAt))
    .limit(10)
    .all()

  const rating = await ensureBattleRating(db, appUser.id)

  const lines: Array<string> = []

  // Rating
  lines.push(
    `${getTierEmoji(rating.rating)} **${getTierLabel(rating.rating)}** — ${rating.rating} rating (${rating.wins}W / ${rating.losses}L)`,
  )
  lines.push('')

  // History
  if (battles.length > 0) {
    lines.push('**Recent Battles:**')
    for (const b of battles) {
      const opponent =
        b.attackerId === appUser.id ? b.defenderName : b.attackerName
      const result =
        b.winnerId === appUser.id
          ? '\u2705 WIN'
          : b.winnerId
            ? '\u274C LOSS'
            : '\uD83E\uDD1D DRAW'
      const modeLabel = b.mode === 'arena' ? 'Arena' : 'Friendly'
      lines.push(
        `${result} vs **${opponent}** (${modeLabel}) — [replay](${APP_URL}/battle/${b.id})`,
      )
    }
  } else {
    lines.push('No battles yet. Visit the web app to start battling!')
  }

  const embed: Embed = {
    title: `\u2694\uFE0F ${appUser.name}'s Battles`,
    description: lines.join('\n'),
    color: 0xe8c95a,
  }

  return ephemeralResponse('', [embed])
}
