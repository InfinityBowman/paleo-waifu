import { and, eq } from 'drizzle-orm'
import { account, user } from '@paleo-waifu/shared/db/schema'
import { ephemeralResponse, getOption } from '../lib/discord'
import {
  ensureBattleRating,
  getTierEmoji,
  getTierLabel,
} from '../lib/battle-helpers'
import type { Embed, Interaction } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'

/** /rating [@user] — Show arena rating (ephemeral) */
export async function handleRating(
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
): Promise<Response> {
  // Check if looking up another user
  const targetDiscordId = getOption<string>(interaction, 'user')
  let targetId = appUser.id
  let targetName = appUser.name

  if (targetDiscordId) {
    const row = await db
      .select({ id: user.id, name: user.name })
      .from(account)
      .innerJoin(user, eq(account.userId, user.id))
      .where(
        and(
          eq(account.providerId, 'discord'),
          eq(account.accountId, targetDiscordId),
        ),
      )
      .get()

    if (!row) {
      return ephemeralResponse(
        "That user hasn't linked their Discord account to PaleoWaifu.",
      )
    }
    targetId = row.id
    targetName = row.name
  }

  const rating = await ensureBattleRating(db, targetId)
  const tier = getTierLabel(rating.rating)
  const emoji = getTierEmoji(rating.rating)

  const barLength = 10
  const tierThresholds = [0, 500, 1000, 1500, 2000]
  const currentTierIdx = tierThresholds.findIndex(
    (_, i) =>
      i === tierThresholds.length - 1 || rating.rating < tierThresholds[i + 1],
  )
  const tierFloor = tierThresholds[currentTierIdx]
  const tierCeil =
    currentTierIdx < tierThresholds.length - 1
      ? tierThresholds[currentTierIdx + 1]
      : tierFloor + 500
  const progress = Math.min(
    1,
    (rating.rating - tierFloor) / (tierCeil - tierFloor),
  )
  const filled = Math.round(progress * barLength)
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLength - filled)

  const embed: Embed = {
    title: `${emoji} ${targetName}'s Arena Rating`,
    description: [
      `**${tier}** — ${rating.rating} rating`,
      `\`${bar}\` ${rating.rating}/${tierCeil}`,
      '',
      `**${rating.wins}** wins \u2022 **${rating.losses}** losses`,
      rating.wins + rating.losses > 0
        ? `Win rate: ${Math.round((rating.wins / (rating.wins + rating.losses)) * 100)}%`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    color: 0xe8c95a,
  }

  return ephemeralResponse('', [embed])
}
