import { eq } from 'drizzle-orm'
import { battleRating, battleTeamPreset } from '@paleo-waifu/shared/db/schema'
import type { Database } from '@paleo-waifu/shared/db/client'

export interface PresetRow {
  id: string
  name: string
  members: string // JSON
}

/** Load all team presets for a user */
export async function loadPresets(
  db: Database,
  userId: string,
): Promise<Array<PresetRow>> {
  return db
    .select({
      id: battleTeamPreset.id,
      name: battleTeamPreset.name,
      members: battleTeamPreset.members,
    })
    .from(battleTeamPreset)
    .where(eq(battleTeamPreset.userId, userId))
    .all()
}

/** Ensure a battle rating row exists for the user */
export async function ensureBattleRating(
  db: Database,
  userId: string,
): Promise<{ rating: number; wins: number; losses: number }> {
  const row = await db
    .select()
    .from(battleRating)
    .where(eq(battleRating.userId, userId))
    .get()

  if (row) return { rating: row.rating, wins: row.wins, losses: row.losses }

  await db
    .insert(battleRating)
    .values({ userId, rating: 0, wins: 0, losses: 0 })
    .onConflictDoNothing()

  return { rating: 0, wins: 0, losses: 0 }
}

/** Get arena tier label for a rating */
export function getTierLabel(rating: number): string {
  if (rating >= 2000) return 'Apex'
  if (rating >= 1500) return 'Diamond'
  if (rating >= 1000) return 'Gold'
  if (rating >= 500) return 'Silver'
  return 'Bronze'
}

/** Get tier emoji */
export function getTierEmoji(rating: number): string {
  if (rating >= 2000) return '\uD83D\uDC51' // crown
  if (rating >= 1500) return '\uD83D\uDC8E' // gem
  if (rating >= 1000) return '\uD83E\uDD47' // gold medal
  if (rating >= 500) return '\uD83E\uDD48' // silver medal
  return '\uD83E\uDD49' // bronze medal
}

/** Parse a custom_id like "battle_accept:abc123" into { action, challengeId } */
export function parseChallengeAction(customId: string): {
  action: string
  challengeId: string
} | null {
  const idx = customId.indexOf(':')
  if (idx === -1) return null
  return {
    action: customId.slice(0, idx),
    challengeId: customId.slice(idx + 1),
  }
}
