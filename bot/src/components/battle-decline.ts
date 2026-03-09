import { and, eq } from 'drizzle-orm'
import { battleChallenge, user } from '@paleo-waifu/shared/db/schema'
import {
  MessageFlags,
  sendFollowup,
  updateMessageResponse,
} from '../lib/discord'
import { declinedEmbed } from '../lib/battle-embeds'
import type { Interaction } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'

/** Handle the Decline button press on a challenge embed */
export async function handleBattleDecline(
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
  challengeId: string,
  env: { DISCORD_APPLICATION_ID: string },
): Promise<Response> {
  // Verify the challenge exists and this user is the defender
  const challenge = await db
    .select({
      id: battleChallenge.id,
      defenderId: battleChallenge.defenderId,
      challengerId: battleChallenge.challengerId,
      status: battleChallenge.status,
    })
    .from(battleChallenge)
    .where(
      and(
        eq(battleChallenge.id, challengeId),
        eq(battleChallenge.status, 'pending'),
      ),
    )
    .get()

  if (!challenge) {
    await sendFollowup(env.DISCORD_APPLICATION_ID, interaction.token, {
      content: 'This challenge is no longer active.',
      flags: MessageFlags.EPHEMERAL,
    })
    // Still update the message to remove buttons
    return updateMessageResponse({
      content: 'This challenge is no longer active.',
      embeds: [],
      components: [],
    })
  }

  if (challenge.defenderId !== appUser.id) {
    await sendFollowup(env.DISCORD_APPLICATION_ID, interaction.token, {
      content: 'Only the challenged player can decline this battle.',
      flags: MessageFlags.EPHEMERAL,
    })
    // Return a no-op update (keep the original message)
    return updateMessageResponse({
      content: interaction.message?.id ? undefined : '',
    })
  }

  // Update challenge status
  await db
    .update(battleChallenge)
    .set({ status: 'declined' })
    .where(eq(battleChallenge.id, challengeId))

  // Get challenger name for the embed
  const challengerRow = await db
    .select({ name: user.name })
    .from(user)
    .where(eq(user.id, challenge.challengerId))
    .get()

  const embed = declinedEmbed(challengerRow?.name ?? 'Unknown', appUser.name)

  // Update the original message to show declined + remove buttons
  return updateMessageResponse({
    content: '',
    embeds: [embed],
    components: [],
  })
}
