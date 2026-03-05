import { and, eq } from 'drizzle-orm'
import { account, user } from '@paleo-waifu/shared/db/schema'
import type { Database } from '@paleo-waifu/shared/db/client'

export interface AppUser {
  id: string
  name: string
  image: string | null
  banned: boolean | null
}

/** Look up the app user by their Discord snowflake ID */
export async function resolveDiscordUser(
  db: Database,
  discordUserId: string,
): Promise<AppUser | null> {
  const row = await db
    .select({
      id: user.id,
      name: user.name,
      image: user.image,
      banned: user.banned,
    })
    .from(account)
    .innerJoin(user, eq(account.userId, user.id))
    .where(
      and(
        eq(account.providerId, 'discord'),
        eq(account.accountId, discordUserId),
      ),
    )
    .get()

  return row ?? null
}
