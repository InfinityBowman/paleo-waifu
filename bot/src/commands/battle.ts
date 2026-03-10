import { ephemeralResponse } from '../lib/discord'
import { APP_URL } from '../lib/constants'
import type { Interaction } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'

interface BattleEnv {
  DISCORD_APPLICATION_ID: string
  DISCORD_BOT_TOKEN: string
}

/** /battle @user — Friendly battle (v2 rework pending) */
export function handleBattle(
  _interaction: Interaction,
  _db: Database,
  _appUser: AppUser,
  _env: BattleEnv,
  _ctx: ExecutionContext,
): Response {
  return ephemeralResponse(
    `Battle commands are being reworked! Manage your teams and battle at ${APP_URL}/battle`,
  )
}
