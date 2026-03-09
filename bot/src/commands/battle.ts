import { eq } from 'drizzle-orm'
import { battleChallenge } from '@paleo-waifu/shared/db/schema'
import {
  deferredResponse,
  editDeferredResponse,
  getOption,
} from '../lib/discord'
import { resolveDiscordUser } from '../lib/auth'
import { loadPresets } from '../lib/battle-helpers'
import {
  challengeButtons,
  challengeEmbed,
  noPresetsMessage,
} from '../lib/battle-embeds'
import type { TeamSlotInput } from '@/lib/battle'
import type { Interaction } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'
import { createChallenge, validateChallenge } from '@/lib/battle'

interface BattleEnv {
  DISCORD_APPLICATION_ID: string
  DISCORD_BOT_TOKEN: string
}

/** /battle @user — Create a battle challenge (deferred) */
export function handleBattle(
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
  env: BattleEnv,
  ctx: ExecutionContext,
): Response {
  ctx.waitUntil(doBattle(interaction, db, appUser, env))
  return deferredResponse()
}

async function doBattle(
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
  env: BattleEnv,
): Promise<void> {
  const edit = (body: Parameters<typeof editDeferredResponse>[2]) =>
    editDeferredResponse(env.DISCORD_APPLICATION_ID, interaction.token, body)

  try {
    // Get target user from option
    const targetDiscordId = getOption<string>(interaction, 'user')
    if (!targetDiscordId) {
      await edit({ content: 'Please specify a user to challenge.' })
      return
    }

    // Resolve target to app user
    const targetUser = await resolveDiscordUser(db, targetDiscordId)
    if (!targetUser) {
      await edit({
        content:
          "That user hasn't linked their Discord account to PaleoWaifu yet.",
      })
      return
    }

    // Load challenger's presets
    const presets = await loadPresets(db, appUser.id)
    if (presets.length === 0) {
      await edit({ content: noPresetsMessage() })
      return
    }

    // Use first preset for MVP (user manages presets in web UI)
    const preset = presets[0]

    // Validate challenge
    const error = await validateChallenge(db, appUser.id, targetUser.id)
    if (error) {
      await edit({ content: error })
      return
    }

    // Parse preset members into team slots
    const members: Array<TeamSlotInput> = JSON.parse(preset.members)

    // Create challenge
    const { id: challengeId } = await createChallenge(
      db,
      appUser.id,
      targetUser.id,
      members,
    )

    // Send the challenge embed with accept/decline buttons
    const embed = challengeEmbed(
      appUser.name,
      targetUser.name,
      preset.name,
      appUser.id,
    )

    await edit({
      content: `<@${targetDiscordId}>`,
      embeds: [embed],
      components: [challengeButtons(challengeId)],
    })

    // Capture the message ID so we can update it when the battle resolves
    // Fetch the original interaction response to get the message ID
    const msgRes = await fetch(
      `https://discord.com/api/v10/webhooks/${env.DISCORD_APPLICATION_ID}/${interaction.token}/messages/@original`,
    )
    if (msgRes.ok) {
      const msg: { id: string; channel_id: string } = await msgRes.json()
      await db
        .update(battleChallenge)
        .set({
          discordMessageId: msg.id,
          discordChannelId: msg.channel_id,
        })
        .where(eq(battleChallenge.id, challengeId))
    }
  } catch (err) {
    console.error('Battle command error:', err)
    await edit({ content: 'Something went wrong creating the challenge.' })
  }
}
