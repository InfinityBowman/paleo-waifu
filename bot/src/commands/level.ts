import { eq } from 'drizzle-orm'
import { userXp } from '@/lib/db/schema'
import { ephemeralResponse, getOption } from '../lib/discord'
import { levelEmbed } from '../lib/embeds'
import { resolveDiscordUser } from '../lib/auth'
import type { Interaction } from '../lib/discord'
import type { Database } from '@/lib/db/client'
import type { AppUser } from '../lib/auth'

/** /level [@user?] — Show XP and level (immediate, ephemeral) */
export async function handleLevel(
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
): Promise<Response> {
  // Check if targeting another user
  const targetDiscordId = getOption<string>(interaction, 'user')

  let targetUserId = appUser.id
  let targetName = appUser.name

  if (targetDiscordId) {
    const targetUser = await resolveDiscordUser(db, targetDiscordId)
    if (!targetUser) {
      return ephemeralResponse(`That user hasn't linked their Discord account yet.`)
    }
    targetUserId = targetUser.id
    targetName = targetUser.name
  }

  const row = await db
    .select({ xp: userXp.xp, level: userXp.level })
    .from(userXp)
    .where(eq(userXp.userId, targetUserId))
    .get()

  if (!row) {
    const msg = targetDiscordId
      ? `That user hasn't earned any XP yet.`
      : `You haven't earned any XP yet — chat in the server to start leveling!`
    return ephemeralResponse(msg)
  }

  const embed = levelEmbed(targetName, row.xp, row.level)
  return ephemeralResponse('', [embed])
}
