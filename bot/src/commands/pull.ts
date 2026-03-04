import { eq } from 'drizzle-orm'
import { deferredResponse, editDeferredResponse } from '../lib/discord'
import { creatureEmbed, multiPullEmbed } from '../lib/embeds'
import type { Interaction } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'
import {
  MULTI_PULL_COUNT,
  PULL_COST_MULTI,
  PULL_COST_SINGLE,
} from '@paleo-waifu/shared/types'
import { banner } from '@paleo-waifu/shared/db/schema'
import {
  deductFossils,
  ensureUserCurrency,
  executePullBatch,
  getFossils,
  refundFossils,
} from '@/lib/gacha'

/** /pull or /pull10 — Gacha pull (deferred) */
export function handlePull(
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
  env: { DISCORD_APPLICATION_ID: string },
  ctx: ExecutionContext,
  count: 1 | 10,
): Response {
  ctx.waitUntil(doPull(interaction, db, appUser, env, count))
  return deferredResponse()
}

async function doPull(
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
  env: { DISCORD_APPLICATION_ID: string },
  count: 1 | 10,
): Promise<void> {
  const edit = (body: {
    content?: string
    embeds?: Parameters<typeof editDeferredResponse>[2]['embeds']
  }) =>
    editDeferredResponse(env.DISCORD_APPLICATION_ID, interaction.token, body)

  try {
    await ensureUserCurrency(db, appUser.id)

    // Find active banner
    const activeBanner = await db
      .select({ id: banner.id, rateUpId: banner.rateUpId })
      .from(banner)
      .where(eq(banner.isActive, true))
      .get()

    if (!activeBanner) {
      await edit({ content: 'No active banner right now. Check back later!' })
      return
    }

    const isMulti = count === 10
    const cost = isMulti ? PULL_COST_MULTI : PULL_COST_SINGLE
    const pullCount = isMulti ? MULTI_PULL_COUNT : 1

    // Deduct fossils
    const success = await deductFossils(db, appUser.id, cost)
    if (!success) {
      const fossils = await getFossils(db, appUser.id)
      await edit({
        content: `Not enough Fossils! You need **${cost}** but only have **${fossils}**.\nUse \`/daily\` to claim free Fossils!`,
      })
      return
    }

    // Execute pull
    try {
      const results = await executePullBatch(
        db,
        appUser.id,
        activeBanner.id,
        activeBanner.rateUpId,
        pullCount,
      )
      const fossils = await getFossils(db, appUser.id)

      if (isMulti) {
        await edit({ embeds: [multiPullEmbed(results, fossils)] })
      } else {
        const embed = creatureEmbed(results[0])
        embed.footer = { text: `Balance: ${fossils} Fossils` }
        await edit({ embeds: [embed] })
      }
    } catch {
      // Refund on failure
      await refundFossils(db, appUser.id, cost)
      const fossils = await getFossils(db, appUser.id)
      await edit({
        content: `Something went wrong with your pull. Your **${cost}** Fossils have been refunded.\n\uD83E\uDEA8 **Balance:** ${fossils} Fossils`,
      })
    }
  } catch {
    await edit({
      content: 'Something went wrong. Please try again!',
    })
  }
}
