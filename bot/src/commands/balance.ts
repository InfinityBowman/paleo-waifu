import { ensureUserCurrency, getFossils } from '@/lib/gacha'
import { ephemeralResponse } from '../lib/discord'
import type { Database } from '@/lib/db/client'
import type { AppUser } from '../lib/auth'

/** /balance — Show fossil count (immediate, ephemeral) */
export async function handleBalance(
  db: Database,
  appUser: AppUser,
): Promise<Response> {
  await ensureUserCurrency(db, appUser.id)
  const fossils = await getFossils(db, appUser.id)
  return ephemeralResponse(`\uD83E\uDEA8 **Fossils:** ${fossils}`)
}
