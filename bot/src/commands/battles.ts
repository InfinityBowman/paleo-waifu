import { desc, eq, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { battleChallenge, user } from '@paleo-waifu/shared/db/schema'
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

/** /battles — Show active challenges and recent history (ephemeral) */
export async function handleBattles(
  db: Database,
  appUser: AppUser,
): Promise<Response> {
  const challenger = alias(user, 'challenger')
  const defender = alias(user, 'defender')

  const challenges = await db
    .select({
      id: battleChallenge.id,
      status: battleChallenge.status,
      challengerId: battleChallenge.challengerId,
      defenderId: battleChallenge.defenderId,
      winnerId: battleChallenge.winnerId,
      challengerName: challenger.name,
      defenderName: defender.name,
      createdAt: battleChallenge.createdAt,
    })
    .from(battleChallenge)
    .innerJoin(challenger, eq(challenger.id, battleChallenge.challengerId))
    .innerJoin(defender, eq(defender.id, battleChallenge.defenderId))
    .where(
      or(
        eq(battleChallenge.challengerId, appUser.id),
        eq(battleChallenge.defenderId, appUser.id),
      ),
    )
    .orderBy(desc(battleChallenge.createdAt))
    .limit(15)
    .all()

  const pending = challenges.filter((c) => c.status === 'pending')
  const resolved = challenges.filter((c) => c.status === 'resolved')

  const rating = await ensureBattleRating(db, appUser.id)

  const lines: Array<string> = []

  // Rating
  lines.push(
    `${getTierEmoji(rating.rating)} **${getTierLabel(rating.rating)}** — ${rating.rating} rating (${rating.wins}W / ${rating.losses}L)`,
  )
  lines.push('')

  // Pending
  if (pending.length > 0) {
    lines.push('**Active Challenges:**')
    for (const c of pending) {
      const isChallenger = c.challengerId === appUser.id
      const opponent = isChallenger ? c.defenderName : c.challengerName
      const direction = isChallenger ? '\u2192' : '\u2190'
      lines.push(`${direction} vs **${opponent}** (pending)`)
    }
    lines.push('')
  }

  // History
  if (resolved.length > 0) {
    lines.push('**Recent Battles:**')
    for (const c of resolved) {
      const opponent =
        c.challengerId === appUser.id ? c.defenderName : c.challengerName
      const result =
        c.winnerId === appUser.id
          ? '\u2705 WIN'
          : c.winnerId
            ? '\u274C LOSS'
            : '\uD83E\uDD1D DRAW'
      lines.push(
        `${result} vs **${opponent}** — [replay](${APP_URL}/battle/${c.id})`,
      )
    }
  }

  if (pending.length === 0 && resolved.length === 0) {
    lines.push('No battles yet. Use `/battle @user` to challenge someone!')
  }

  const embed: Embed = {
    title: `\u2694\uFE0F ${appUser.name}'s Battles`,
    description: lines.join('\n'),
    color: 0xe8c95a,
  }

  return ephemeralResponse('', [embed])
}
