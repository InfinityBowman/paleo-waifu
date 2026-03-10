import { ephemeralResponse } from '../lib/discord'
import type { Interaction } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'

/** Handle the Decline button press — disabled during v2 rework */
export function handleBattleDecline(
  _interaction: Interaction,
  _db: Database,
  _appUser: AppUser,
  _challengeId: string,
  _env: { DISCORD_APPLICATION_ID: string },
): Response {
  return ephemeralResponse(
    'This battle system is being reworked. Please use the web app.',
  )
}
