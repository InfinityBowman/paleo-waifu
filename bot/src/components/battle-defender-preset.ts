import { ephemeralResponse } from '../lib/discord'
import type { Interaction } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'

interface PresetEnv {
  DISCORD_APPLICATION_ID: string
  DISCORD_BOT_TOKEN: string
}

/** Handle defender selecting a preset — disabled during v2 rework */
export function handleDefenderPreset(
  _interaction: Interaction,
  _db: Database,
  _appUser: AppUser,
  _challengeId: string,
  _presetId: string,
  _env: PresetEnv,
  _ctx: ExecutionContext,
): Response {
  return ephemeralResponse(
    'This battle system is being reworked. Please use the web app.',
  )
}
