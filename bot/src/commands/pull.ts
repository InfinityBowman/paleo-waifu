import { eq } from 'drizzle-orm'
import { banner } from '@paleo-waifu/shared/db/schema'
import { deferredResponse, editDeferredResponse } from '../lib/discord'
import { creatureEmbed, multiPullEmbed } from '../lib/embeds'
import type { Interaction } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'
import { fossils, pull } from '@/lib/gacha'
import { toCdnUrl } from '@/lib/utils'

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
    await fossils.ensure(db, appUser.id)

    // Find active banner
    const activeBanner = await db
      .select({ id: banner.id })
      .from(banner)
      .where(eq(banner.isActive, true))
      .get()

    if (!activeBanner) {
      await edit({ content: 'No active banner right now. Check back later!' })
      return
    }

    const outcome = await pull(db, appUser.id, {
      mode: count === 10 ? 'multi' : 'single',
      bannerId: activeBanner.id,
      transformImageUrl: toCdnUrl,
    })

    if (!outcome.ok) {
      if (outcome.reason === 'insufficient_fossils') {
        await edit({
          content: `Not enough Fossils! You have **${outcome.fossils}**.\nUse \`/daily\` to claim free Fossils!`,
        })
      } else if (outcome.reason === 'banner_not_found') {
        await edit({ content: 'No active banner right now. Check back later!' })
      } else {
        await edit({
          content: `Something went wrong with your pull. Your Fossils have been refunded.\n\uD83E\uDEA8 **Balance:** ${outcome.fossils} Fossils`,
        })
      }
      return
    }

    if (count === 10) {
      await edit({ embeds: [multiPullEmbed(outcome.results, outcome.fossils)] })
    } else {
      const embed = creatureEmbed(outcome.results[0])
      embed.footer = { text: `Balance: ${outcome.fossils} Fossils` }
      await edit({ embeds: [embed] })
    }
  } catch {
    await edit({
      content: 'Something went wrong. Please try again!',
    })
  }
}
