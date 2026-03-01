import { deferredResponse, editDeferredResponse } from '../lib/discord'
import type { Interaction } from '../lib/discord'
import type { Database } from '@/lib/db/client'
import type { AppUser } from '../lib/auth'
import { DAILY_FOSSILS } from '@/lib/types'
import { claimDaily, ensureUserCurrency } from '@/lib/gacha'

/** /daily — Claim daily fossils (deferred) */
export function handleDaily(
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
  env: { DISCORD_APPLICATION_ID: string },
  ctx: ExecutionContext,
): Response {
  ctx.waitUntil(doDailyClaim(interaction, db, appUser, env))
  return deferredResponse(true)
}

async function doDailyClaim(
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
  env: { DISCORD_APPLICATION_ID: string },
): Promise<void> {
  try {
    await ensureUserCurrency(db, appUser.id)
    const result = await claimDaily(db, appUser.id)

    if (result.claimed) {
      await editDeferredResponse(
        env.DISCORD_APPLICATION_ID,
        interaction.token,
        {
          content: `\uD83E\uDEA8 **+${DAILY_FOSSILS} Fossils** claimed! You now have **${result.fossils}** Fossils.`,
        },
      )
    } else {
      await editDeferredResponse(
        env.DISCORD_APPLICATION_ID,
        interaction.token,
        {
          content: `You've already claimed your daily Fossils! Come back after midnight UTC.\n\uD83E\uDEA8 **Balance:** ${result.fossils} Fossils`,
        },
      )
    }
  } catch {
    await editDeferredResponse(env.DISCORD_APPLICATION_ID, interaction.token, {
      content: 'Something went wrong claiming your daily reward. Try again!',
    })
  }
}
