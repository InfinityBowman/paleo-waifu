import { and, eq } from 'drizzle-orm'
import { battleChallenge } from '@paleo-waifu/shared/db/schema'
import { deferredResponse, editDeferredResponse } from '../lib/discord'
import { loadPresets } from '../lib/battle-helpers'
import { noPresetsMessage, presetSelectMenu } from '../lib/battle-embeds'
import type { Interaction } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'

interface AcceptEnv {
  DISCORD_APPLICATION_ID: string
}

/** Handle the Accept button press on a challenge embed */
export function handleBattleAccept(
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
  challengeId: string,
  env: AcceptEnv,
  ctx: ExecutionContext,
): Response {
  ctx.waitUntil(doAccept(interaction, db, appUser, challengeId, env))
  // Use ephemeral deferred response so the public challenge embed stays intact
  return deferredResponse(true)
}

async function doAccept(
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
  challengeId: string,
  env: AcceptEnv,
): Promise<void> {
  const edit = (body: Parameters<typeof editDeferredResponse>[2]) =>
    editDeferredResponse(env.DISCORD_APPLICATION_ID, interaction.token, body)

  try {
    // Verify the challenge exists and this user is the defender
    const challenge = await db
      .select({
        id: battleChallenge.id,
        defenderId: battleChallenge.defenderId,
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
      await edit({ content: 'This challenge is no longer active.' })
      return
    }

    if (challenge.defenderId !== appUser.id) {
      await edit({
        content: 'Only the challenged player can accept this battle.',
      })
      return
    }

    // Load defender's presets
    const presets = await loadPresets(db, appUser.id)
    if (presets.length === 0) {
      await edit({ content: noPresetsMessage() })
      return
    }

    // Send ephemeral preset select menu to the defender
    await edit({
      content: 'Choose your team preset for this battle:',
      components: [
        presetSelectMenu(
          challengeId,
          presets.map((p) => ({ id: p.id, name: p.name })),
          false,
        ),
      ],
    })
  } catch (err) {
    console.error('Battle accept error:', err)
    await edit({ content: 'Something went wrong. Try again!' })
  }
}
