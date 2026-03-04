import { eq, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import type { Database } from '@paleo-waifu/shared/db/client'
import { userXp } from '@paleo-waifu/shared/db/schema'
import {
  XP_MAX_PER_MESSAGE,
  XP_MIN_PER_MESSAGE,
  fossilsForLevel,
  levelFromXp,
} from '@paleo-waifu/shared/xp'
import { ensureUserCurrency, grantFossils } from '@/lib/gacha'

export interface XpAwardResult {
  xp: number
  level: number
  leveledUp: boolean
  fossilsEarned: number
}

function randomXpDelta(): number {
  return (
    Math.floor(Math.random() * (XP_MAX_PER_MESSAGE - XP_MIN_PER_MESSAGE + 1)) +
    XP_MIN_PER_MESSAGE
  )
}

/** Award XP to a user, recalculate level atomically, return result */
export async function awardXp(
  db: Database,
  userId: string,
): Promise<XpAwardResult> {
  const delta = randomXpDelta()

  // Upsert: create row if first XP award, otherwise increment XP and recompute level atomically
  await db
    .insert(userXp)
    .values({
      id: nanoid(),
      userId,
      xp: delta,
      level: levelFromXp(delta),
    })
    .onConflictDoUpdate({
      target: userXp.userId,
      set: {
        xp: sql`${userXp.xp} + ${delta}`,
        level: sql`CAST(SQRT((${userXp.xp} + ${delta}) / 100.0) AS INTEGER)`,
        updatedAt: sql`(unixepoch())`,
      },
    })

  // Read back the updated row to detect level-up
  // Note: level is already correct from the upsert above — we compare with
  // the pre-upsert level to determine if a level-up occurred
  const row = await db
    .select({ xp: userXp.xp, level: userXp.level })
    .from(userXp)
    .where(eq(userXp.userId, userId))
    .get()

  if (!row) throw new Error('user_xp row missing after upsert')

  // The level from the DB is the new level (set atomically in the upsert).
  // We detect level-up by checking if the old XP (before delta) had a lower level.
  const oldLevel = levelFromXp(row.xp - delta)
  const leveledUp = row.level > oldLevel

  let fossilsEarned = 0
  if (leveledUp) {
    for (let lvl = oldLevel + 1; lvl <= row.level; lvl++) {
      fossilsEarned += fossilsForLevel(lvl)
    }
    await ensureUserCurrency(db, userId)
    await grantFossils(db, userId, fossilsEarned)
  }

  return {
    xp: row.xp,
    level: row.level,
    leveledUp,
    fossilsEarned,
  }
}
