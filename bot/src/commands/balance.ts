import { ephemeralResponse } from '../lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from '../lib/auth'
import { fossils } from '@/lib/gacha'

/** /balance — Show fossil count (immediate, ephemeral) */
export async function handleBalance(
  db: Database,
  appUser: AppUser,
): Promise<Response> {
  await fossils.ensure(db, appUser.id)
  const balance = await fossils.get(db, appUser.id)
  return ephemeralResponse(`\uD83E\uDEA8 **Fossils:** ${balance}`)
}
