import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { eq, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { createDb } from '@paleo-waifu/shared/db/client'
import {
  battleLog,
  battleRating,
  creature,
  creatureBattleStats,
  user,
  userCreature,
} from '@paleo-waifu/shared/db/schema'
import type { BattleResult } from '@paleo-waifu/shared/battle/types'
import type { Database } from '@paleo-waifu/shared/db/client'
import { IconFossil } from '@/components/icons'
import { getCfEnv } from '@/lib/env'
import { toCdnUrl } from '@/lib/utils'
import { getArenaTier } from '@/lib/battle'
import { BattleReplay } from '@/components/battle/BattleReplay'

type TeamCreature = {
  name: string
  rarity: string
  role: string
  imageUrl: string | null
  row: string
}

async function loadTeamCreatures(
  db: Database,
  teamJson: string,
): Promise<Array<TeamCreature>> {
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
    .filter(Boolean) as Array<TeamCreature>
}

const getBattleById = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: battleId }) => {
    const cfEnv = getCfEnv()
    const { getRequest } = await import('@tanstack/react-start/server')
    const { createAuth } = await import('@/lib/auth')
    const request = getRequest()
    const auth = await createAuth(cfEnv)
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return null

    const db = await createDb(cfEnv.DB)

    const attackerUser = alias(user, 'attacker_user')
    const defenderUser = alias(user, 'defender_user')

    const entry = await db
      .select({
        id: battleLog.id,
        attackerId: battleLog.attackerId,
        attackerName: attackerUser.name,
        attackerImage: attackerUser.image,
        defenderId: battleLog.defenderId,
        defenderName: defenderUser.name,
        defenderImage: defenderUser.image,
        attackerTeam: battleLog.attackerTeam,
        defenderTeam: battleLog.defenderTeam,
        result: battleLog.result,
        winnerId: battleLog.winnerId,
        mode: battleLog.mode,
        createdAt: battleLog.createdAt,
      })
      .from(battleLog)
      .innerJoin(attackerUser, eq(attackerUser.id, battleLog.attackerId))
      .innerJoin(defenderUser, eq(defenderUser.id, battleLog.defenderId))
      .where(eq(battleLog.id, battleId))
      .get()

    if (!entry) return null

    const [attackerRating, defenderRating] = await Promise.all([
      db
        .select()
        .from(battleRating)
        .where(eq(battleRating.userId, entry.attackerId))
        .get(),
      db
        .select()
        .from(battleRating)
        .where(eq(battleRating.userId, entry.defenderId))
        .get(),
    ])

    const [teamA, teamB] = await Promise.all([
      loadTeamCreatures(db, entry.attackerTeam),
      loadTeamCreatures(db, entry.defenderTeam),
    ])

    return {
      challenge: {
        id: entry.id,
        challengerName: entry.attackerName,
        challengerImage: entry.attackerImage,
        defenderName: entry.defenderName,
        defenderImage: entry.defenderImage,
        winnerId: entry.winnerId,
        challengerId: entry.attackerId,
        defenderId: entry.defenderId,
        status: 'resolved',
        createdAt: entry.createdAt,
        resolvedAt: entry.createdAt,
      },
      result: JSON.parse(entry.result) as BattleResult,
      teamA,
      teamB,
      ratings: {
        challenger: {
          rating: attackerRating?.rating ?? 0,
          tier: getArenaTier(attackerRating?.rating ?? 0),
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
        <IconFossil className="mx-auto mb-4 h-12 w-12 text-muted-foreground/20" />
        <h1 className="font-display text-2xl font-bold">Battle Not Found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This battle doesn&apos;t exist or has been removed.
        </p>
        <Link
          to="/battle"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          &larr; Back to Arena
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <Link
        to="/battle"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary"
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
