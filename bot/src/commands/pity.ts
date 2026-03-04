import { and, eq } from 'drizzle-orm'
import { ephemeralResponse } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'
import { HARD_PITY_THRESHOLD, SOFT_PITY_THRESHOLD } from '@paleo-waifu/shared/types'
import { banner, pityCounter } from '@paleo-waifu/shared/db/schema'

/** /pity — Show pity counters for active banner (immediate, ephemeral) */
export async function handlePity(
  db: Database,
  appUser: AppUser,
): Promise<Response> {
  // Find active banner
  const activeBanner = await db
    .select({ id: banner.id, name: banner.name })
    .from(banner)
    .where(eq(banner.isActive, true))
    .get()

  if (!activeBanner) {
    return ephemeralResponse('No active banner right now.')
  }

  // Get pity counter for this banner
  const pity = await db
    .select({
      pullsSinceRare: pityCounter.pullsSinceRare,
      pullsSinceLegendary: pityCounter.pullsSinceLegendary,
      totalPulls: pityCounter.totalPulls,
    })
    .from(pityCounter)
    .where(
      and(
        eq(pityCounter.userId, appUser.id),
        eq(pityCounter.bannerId, activeBanner.id),
      ),
    )
    .get()

  const rare = pity?.pullsSinceRare ?? 0
  const legendary = pity?.pullsSinceLegendary ?? 0
  const total = pity?.totalPulls ?? 0

  const rareSoft = Math.max(0, SOFT_PITY_THRESHOLD - rare)
  const legendarySoft = Math.max(0, SOFT_PITY_THRESHOLD - legendary)
  const legendaryHard = Math.max(0, HARD_PITY_THRESHOLD - legendary)

  const lines = [
    `**${activeBanner.name}**`,
    '',
    `Total pulls: **${total}**`,
    `Pulls since rare+: **${rare}** (soft pity in ${rareSoft})`,
    `Pulls since legendary: **${legendary}** (soft pity in ${legendarySoft}, guaranteed in ${legendaryHard})`,
  ]

  return ephemeralResponse(lines.join('\n'))
}
