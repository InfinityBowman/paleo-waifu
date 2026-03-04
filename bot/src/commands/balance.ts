import { ephemeralResponse } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'
import { ensureUserCurrency, getFossils } from '@/lib/gacha'

/** /balance — Show fossil count (immediate, ephemeral) */
export async function handleBalance(
  db: Database,
  appUser: AppUser,
): Promise<Response> {
  await ensureUserCurrency(db, appUser.id)
  const fossils = await getFossils(db, appUser.id)
  return ephemeralResponse(`\uD83E\uDEA8 **Fossils:** ${fossils}`)
}
