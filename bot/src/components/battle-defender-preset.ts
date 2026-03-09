import { and, eq } from 'drizzle-orm'
import {
  battleChallenge,
  battleRating,
  battleTeamPreset,
  user,
} from '@paleo-waifu/shared/db/schema'
import {
  MessageFlags,
  deferredUpdateResponse,
  editChannelMessage,
  editDeferredResponse,
  sendFollowup,
} from '../lib/discord'
import { battleResultEmbed } from '../lib/battle-embeds'
import type { TeamSlotInput } from '@/lib/battle'
import type { Interaction } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'
import { resolveBattle } from '@/lib/battle'

interface PresetEnv {
  DISCORD_APPLICATION_ID: string
  DISCORD_BOT_TOKEN: string
}

/** Handle defender selecting a preset from the dropdown */
export function handleDefenderPreset(
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
  challengeId: string,
  presetId: string,
  env: PresetEnv,
  ctx: ExecutionContext,
): Response {
  ctx.waitUntil(
    doDefenderPreset(interaction, db, appUser, challengeId, presetId, env),
  )
  return deferredUpdateResponse()
}

async function doDefenderPreset(
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
  challengeId: string,
  presetId: string,
  env: PresetEnv,
): Promise<void> {
  try {
    // Load the selected preset
    const preset = await db
      .select({
        id: battleTeamPreset.id,
        members: battleTeamPreset.members,
      })
      .from(battleTeamPreset)
      .where(
        and(
          eq(battleTeamPreset.id, presetId),
          eq(battleTeamPreset.userId, appUser.id),
        ),
      )
      .get()

    if (!preset) {
      await sendFollowup(env.DISCORD_APPLICATION_ID, interaction.token, {
        content: 'Preset not found. It may have been deleted.',
        flags: MessageFlags.EPHEMERAL,
      })
      return
    }

    const defenderTeam: Array<TeamSlotInput> = JSON.parse(preset.members)

    // Resolve the battle
    const result = await resolveBattle(
      db,
      challengeId,
      appUser.id,
      defenderTeam,
    )

    if (!result.success) {
      await sendFollowup(env.DISCORD_APPLICATION_ID, interaction.token, {
        content: result.error,
        flags: MessageFlags.EPHEMERAL,
      })
      return
    }

    // Load challenge details for the result embed
    const challenge = await db
      .select({
        challengerId: battleChallenge.challengerId,
        defenderId: battleChallenge.defenderId,
        winnerId: battleChallenge.winnerId,
        discordChannelId: battleChallenge.discordChannelId,
        discordMessageId: battleChallenge.discordMessageId,
      })
      .from(battleChallenge)
      .where(eq(battleChallenge.id, challengeId))
      .get()

    if (!challenge) return

    // Load names and ratings
    const [challengerUser, defenderUser, challengerRating, defenderRating] =
      await Promise.all([
        db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, challenge.challengerId))
          .get(),
        db
          .select({ name: user.name })
          .from(user)
          .where(eq(user.id, challenge.defenderId))
          .get(),
        db
          .select({ rating: battleRating.rating })
          .from(battleRating)
          .where(eq(battleRating.userId, challenge.challengerId))
          .get(),
        db
          .select({ rating: battleRating.rating })
          .from(battleRating)
          .where(eq(battleRating.userId, challenge.defenderId))
          .get(),
      ])

    const cRating = challengerRating?.rating ?? 0
    const dRating = defenderRating?.rating ?? 0

    // Compute deltas for display
    const isWinnerChallenger = challenge.winnerId === challenge.challengerId
    const isWinnerDefender = challenge.winnerId === challenge.defenderId
    const challengerDelta = isWinnerChallenger ? 25 : isWinnerDefender ? -20 : 0
    const defenderDelta = isWinnerDefender ? 25 : isWinnerChallenger ? -20 : 0

    // Load the resolved challenge to get battle result for turns info
    const resolved = await db
      .select({ result: battleChallenge.result })
      .from(battleChallenge)
      .where(eq(battleChallenge.id, challengeId))
      .get()

    let turns = 0
    let reason = 'ko'
    if (resolved?.result) {
      try {
        const parsed = JSON.parse(resolved.result)
        turns = parsed.turns ?? 0
        reason = parsed.reason ?? 'ko'
      } catch {
        // ignore parse errors
      }
    }

    const embed = battleResultEmbed({
      challengerName: challengerUser?.name ?? 'Unknown',
      defenderName: defenderUser?.name ?? 'Unknown',
      winnerId: challenge.winnerId,
      challengerId: challenge.challengerId,
      defenderId: challenge.defenderId,
      turns,
      reason,
      challengerRating: cRating,
      defenderRating: dRating,
      challengerDelta,
      defenderDelta,
      battleId: challengeId,
    })

    // Update the original challenge message (if we have the message info)
    if (challenge.discordChannelId && challenge.discordMessageId) {
      await editChannelMessage(
        challenge.discordChannelId,
        challenge.discordMessageId,
        env.DISCORD_BOT_TOKEN,
        {
          content: '',
          embeds: [embed],
          components: [],
        },
      )
    }

    // Also send as ephemeral followup to the defender
    await editDeferredResponse(env.DISCORD_APPLICATION_ID, interaction.token, {
      content: '',
      embeds: [embed],
    })
  } catch (err) {
    console.error('Defender preset error:', err)
    await sendFollowup(env.DISCORD_APPLICATION_ID, interaction.token, {
      content: 'Something went wrong resolving the battle. Try again!',
      flags: MessageFlags.EPHEMERAL,
    })
  }
}
