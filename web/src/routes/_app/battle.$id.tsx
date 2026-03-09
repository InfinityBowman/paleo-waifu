import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { eq, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { createDb } from '@paleo-waifu/shared/db/client'
import {
  battleChallenge,
  battleRating,
  creature,
  creatureBattleStats,
  user,
  userCreature,
} from '@paleo-waifu/shared/db/schema'
import type { BattleResult } from '@paleo-waifu/shared/battle/types'
import { getCfEnv } from '@/lib/env'
import { toCdnUrl } from '@/lib/utils'
import { getArenaTier } from '@/lib/battle'
import { BattleReplay } from '@/components/battle/BattleReplay'

const getBattleById = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: battleId }) => {
    const db = await createDb(getCfEnv().DB)

    const challengerUser = alias(user, 'challenger_user')
    const defenderUser = alias(user, 'defender_user')

    const challenge = await db
      .select({
        id: battleChallenge.id,
        challengerId: battleChallenge.challengerId,
        challengerName: challengerUser.name,
        challengerImage: challengerUser.image,
        defenderId: battleChallenge.defenderId,
        defenderName: defenderUser.name,
        defenderImage: defenderUser.image,
        status: battleChallenge.status,
        challengerTeam: battleChallenge.challengerTeam,
        defenderTeam: battleChallenge.defenderTeam,
        result: battleChallenge.result,
        winnerId: battleChallenge.winnerId,
        createdAt: battleChallenge.createdAt,
        resolvedAt: battleChallenge.resolvedAt,
      })
      .from(battleChallenge)
      .innerJoin(
        challengerUser,
        eq(challengerUser.id, battleChallenge.challengerId),
      )
      .innerJoin(defenderUser, eq(defenderUser.id, battleChallenge.defenderId))
      .where(eq(battleChallenge.id, battleId))
      .get()

    if (!challenge) return null

    // Get ratings for both players
    const [challengerRating, defenderRating] = await Promise.all([
      db
        .select()
        .from(battleRating)
        .where(eq(battleRating.userId, challenge.challengerId))
        .get(),
      db
        .select()
        .from(battleRating)
        .where(eq(battleRating.userId, challenge.defenderId))
        .get(),
    ])

    // If resolved, get creature details for the team display
    let teamACreatures: Array<{
      name: string
      rarity: string
      role: string
      imageUrl: string | null
      row: string
    }> = []
    let teamBCreatures: Array<{
      name: string
      rarity: string
      role: string
      imageUrl: string | null
      row: string
    }> = []

    // Batch-load team creatures (2 queries instead of N+1)
    async function loadTeamCreatures(
      teamJson: string | null,
    ): Promise<typeof teamACreatures> {
      if (!teamJson) return []
      const slots = JSON.parse(teamJson) as Array<{
        userCreatureId: string
        row: string
      }>
      const ucIds = slots.map((s) => s.userCreatureId)
      const rowMap = new Map(slots.map((s) => [s.userCreatureId, s.row]))
      const rows = await db
        .select({
          ucId: userCreature.id,
          name: creature.name,
          rarity: creature.rarity,
          role: creatureBattleStats.role,
          imageUrl: creature.imageUrl,
        })
        .from(userCreature)
        .innerJoin(creature, eq(creature.id, userCreature.creatureId))
        .innerJoin(
          creatureBattleStats,
          eq(creatureBattleStats.creatureId, creature.id),
        )
        .where(inArray(userCreature.id, ucIds))
        .all()
      const byId = new Map(rows.map((r) => [r.ucId, r]))
      return ucIds
        .map((ucId) => {
          const r = byId.get(ucId)
          if (!r) return null
          return {
            name: r.name,
            rarity: r.rarity,
            role: r.role,
            imageUrl: toCdnUrl(r.imageUrl),
            row: rowMap.get(ucId) ?? 'front',
          }
        })
        .filter(Boolean) as typeof teamACreatures
    }

    const [loadedTeamA, loadedTeamB] = await Promise.all([
      loadTeamCreatures(challenge.challengerTeam),
      loadTeamCreatures(challenge.defenderTeam),
    ])
    teamACreatures = loadedTeamA
    teamBCreatures = loadedTeamB

    return {
      challenge: {
        id: challenge.id,
        challengerName: challenge.challengerName,
        challengerImage: challenge.challengerImage,
        defenderName: challenge.defenderName,
        defenderImage: challenge.defenderImage,
        winnerId: challenge.winnerId,
        challengerId: challenge.challengerId,
        defenderId: challenge.defenderId,
        status: challenge.status,
        createdAt: challenge.createdAt,
        resolvedAt: challenge.resolvedAt,
      },
      result: challenge.result
        ? (JSON.parse(challenge.result) as BattleResult)
        : null,
      teamA: teamACreatures,
      teamB: teamBCreatures,
      ratings: {
        challenger: {
          rating: challengerRating?.rating ?? 0,
          tier: getArenaTier(challengerRating?.rating ?? 0),
        },
        defender: {
          rating: defenderRating?.rating ?? 0,
          tier: getArenaTier(defenderRating?.rating ?? 0),
        },
      },
    }
  })

export const Route = createFileRoute('/_app/battle/$id')({
  loader: ({ params }) => getBattleById({ data: params.id }),
  component: BattleReplayPage,
})

function BattleReplayPage() {
  const data = Route.useLoaderData()

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="font-display text-2xl font-bold">Battle Not Found</h1>
        <p className="mt-2 text-muted-foreground">
          This battle doesn&apos;t exist or has been removed.
        </p>
        <Link
          to="/battle"
          className="mt-4 inline-block text-amber-400 hover:underline"
        >
          Back to Arena
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        to="/battle"
        className="mb-4 inline-block text-sm text-muted-foreground hover:text-amber-400"
      >
        &larr; Back to Arena
      </Link>
      <BattleReplay
        challenge={data.challenge}
        result={data.result}
        teamA={data.teamA}
        teamB={data.teamB}
        ratings={data.ratings}
      />
    </div>
  )
}
