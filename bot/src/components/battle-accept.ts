import { ephemeralResponse } from '../lib/discord'
import type { Interaction } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'

interface AcceptEnv {
  DISCORD_APPLICATION_ID: string
}

/** Handle the Accept button press — disabled during v2 rework */
export function handleBattleAccept(
  _interaction: Interaction,
  _db: Database,
  _appUser: AppUser,
  _challengeId: string,
  _env: AcceptEnv,
  _ctx: ExecutionContext,
): Response {
  return ephemeralResponse(
    'This battle system is being reworked. Please use the web app.',
  )
}
