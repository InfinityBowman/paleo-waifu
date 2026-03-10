import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { desc, eq, inArray, like, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { createDb } from '@paleo-waifu/shared/db/client'
import { ALL_ABILITY_TEMPLATES } from '@paleo-waifu/shared/battle/constants'
import {
  battleLog,
  battleRating,
  creature,
  creatureAbility,
  creatureBattleStats,
  user,
  userCreature,
} from '@paleo-waifu/shared/db/schema'
import { getCfEnv } from '@/lib/env'
import { toCdnUrl } from '@/lib/utils'
import {
  ARENA_DAILY_LIMIT,
  checkDailyLimit,
  findArenaOpponents,
  getArenaTier,
  getTeams,
} from '@/lib/battle'
import { BattleList } from '@/components/battle/BattleList'

const TEMPLATE_MAP = new Map(ALL_ABILITY_TEMPLATES.map((t) => [t.id, t]))

export const searchUsers = createServerFn({ method: 'GET' })
  .inputValidator((d: { query: string; excludeId: string }) => d)
  .handler(async ({ data: { query, excludeId } }) => {
    if (!query || query.length < 2) return []
    const cfEnv = getCfEnv()
    const { getRequest } = await import('@tanstack/react-start/server')
    const { createAuth } = await import('@/lib/auth')
    const request = getRequest()
    const auth = await createAuth(cfEnv)
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return []
    const db = await createDb(cfEnv.DB)
    const results = await db
      .select({
        id: user.id,
        name: user.name,
        image: user.image,
      })
      .from(user)
      .where(like(user.name, `%${query}%`))
      .limit(10)
      .all()
    return results.filter((u) => u.id !== excludeId)
  })

export const refreshOpponents = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    const db = await createDb(getCfEnv().DB)
    const ratingRow = await db
      .select({ rating: battleRating.rating })
      .from(battleRating)
      .where(eq(battleRating.userId, userId))
      .get()
    const myRating = ratingRow?.rating ?? 0

    const opponents = await findArenaOpponents(db, userId, myRating)

    // Enrich opponent defense teams with creature details
    const allUcIds = opponents.flatMap((o) =>
      o.defenseTeam.map((s) => s.userCreatureId),
    )
    if (allUcIds.length === 0)
      return opponents.map((o) => ({
        ...o,
        defenseCreatures: [],
      }))

    const creatureRows = await db
      .select({
        ucId: userCreature.id,
        creatureId: creature.id,
        name: creature.name,
        rarity: creature.rarity,
        imageUrl: creature.imageUrl,
        role: creatureBattleStats.role,
      })
      .from(userCreature)
      .innerJoin(creature, eq(creature.id, userCreature.creatureId))
      .innerJoin(
        creatureBattleStats,
        eq(creatureBattleStats.creatureId, creature.id),
      )
      .where(inArray(userCreature.id, allUcIds))
      .all()

    const creatureMap = new Map(creatureRows.map((r) => [r.ucId, r]))

    return opponents.map((o) => ({
      ...o,
      defenseCreatures: o.defenseTeam.map((s) => {
        const c = creatureMap.get(s.userCreatureId)
        return {
          name: c?.name ?? 'Unknown',
          rarity: c?.rarity ?? 'common',
          role: c?.role ?? 'striker',
          imageUrl: c?.imageUrl ? toCdnUrl(c.imageUrl) : null,
          row: s.row,
        }
      }),
    }))
  })

const getBattleData = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    const db = await createDb(getCfEnv().DB)

    const attackerUser = alias(user, 'attacker_user')
    const defenderUser = alias(user, 'defender_user')

    const [history, teams, battleReadyCreatures, myRatingRow, dailyLimit] =
      await Promise.all([
        // Recent battle history
        db
          .select({
            id: battleLog.id,
            attackerId: battleLog.attackerId,
            attackerName: attackerUser.name,
            attackerImage: attackerUser.image,
            defenderId: battleLog.defenderId,
            defenderName: defenderUser.name,
            defenderImage: defenderUser.image,
            mode: battleLog.mode,
            winnerId: battleLog.winnerId,
            ratingChange: battleLog.ratingChange,
            createdAt: battleLog.createdAt,
          })
          .from(battleLog)
          .innerJoin(attackerUser, eq(attackerUser.id, battleLog.attackerId))
          .innerJoin(defenderUser, eq(defenderUser.id, battleLog.defenderId))
          .where(
            or(
              eq(battleLog.attackerId, userId),
              eq(battleLog.defenderId, userId),
            ),
          )
          .orderBy(desc(battleLog.createdAt))
          .limit(30)
          .all(),

        // My teams (offense + defense)
        getTeams(db, userId),

        // Battle-ready creatures
        db
          .select({
            id: userCreature.id,
            creatureId: creature.id,
            name: creature.name,
            scientificName: creature.scientificName,
            rarity: creature.rarity,
            era: creature.era,
            diet: creature.diet,
            type: creature.type,
            imageUrl: creature.imageUrl,
            imageAspectRatio: creature.imageAspectRatio,
            role: creatureBattleStats.role,
            hp: creatureBattleStats.hp,
            atk: creatureBattleStats.atk,
            def: creatureBattleStats.def,
            spd: creatureBattleStats.spd,
          })
          .from(userCreature)
          .innerJoin(creature, eq(creature.id, userCreature.creatureId))
          .innerJoin(
            creatureBattleStats,
            eq(creatureBattleStats.creatureId, creature.id),
          )
          .where(eq(userCreature.userId, userId))
          .all(),

        // My rating
        db
          .select()
          .from(battleRating)
          .where(eq(battleRating.userId, userId))
          .get(),

        // Daily limit check
        checkDailyLimit(db, userId),
      ])

    // Load abilities for battle-ready creatures
    const creatureIds = [
      ...new Set(battleReadyCreatures.map((c) => c.creatureId)),
    ]
    const abilities =
      creatureIds.length > 0
        ? await db
            .select({
              creatureId: creatureAbility.creatureId,
              templateId: creatureAbility.templateId,
              slot: creatureAbility.slot,
              displayName: creatureAbility.displayName,
            })
            .from(creatureAbility)
            .where(inArray(creatureAbility.creatureId, creatureIds))
            .all()
        : []

    const abilityMap = new Map<
      string,
      {
        active?: { displayName: string; description: string; cooldown: number }
        passive?: { displayName: string; description: string }
      }
    >()
    for (const a of abilities) {
      const template = TEMPLATE_MAP.get(a.templateId)
      if (!template) continue
      const entry = abilityMap.get(a.creatureId) ?? {}
      if (a.slot === 'active') {
        entry.active = {
          displayName: a.displayName,
          description: template.description,
          cooldown:
            template.trigger.type === 'onUse' ? template.trigger.cooldown : 1,
        }
      } else {
        entry.passive = {
          displayName: a.displayName,
          description: template.description,
        }
      }
      abilityMap.set(a.creatureId, entry)
    }

    return {
      history,
      teams,
      battleReadyCreatures: battleReadyCreatures.map((c) => {
        const abs = abilityMap.get(c.creatureId)
        return {
          ...c,
          imageUrl: toCdnUrl(c.imageUrl),
          active: abs?.active ?? null,
          passive: abs?.passive ?? null,
        }
      }),
      userId,
      myRating: myRatingRow
        ? {
            rating: myRatingRow.rating,
            wins: myRatingRow.wins,
            losses: myRatingRow.losses,
            tier: getArenaTier(myRatingRow.rating),
          }
        : { rating: 0, wins: 0, losses: 0, tier: 'Bronze' },
      dailyLimit: {
        remaining: dailyLimit.remaining,
        total: ARENA_DAILY_LIMIT,
      },
    }
  })

export const Route = createFileRoute('/_app/battle/')({
  loader: ({ context }) => getBattleData({ data: context.session.user.id }),
  component: BattlePage,
})

function BattlePage() {
  const data = Route.useLoaderData()
  const { session } = Route.useRouteContext()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 2xl:max-w-400">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Arena</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Battle other players with your prehistoric team.
        </p>
        <div className="mt-3 inline-flex items-center gap-3 rounded-lg border border-border bg-card/50 px-4 py-2 text-sm">
          <span className="font-display font-semibold text-primary">
            {data.myRating.tier}
          </span>
          <span className="text-muted-foreground/30">|</span>
          <span className="font-medium">{data.myRating.rating} Rating</span>
          <span className="text-muted-foreground/30">|</span>
          <span className="text-muted-foreground">
            <span className="font-medium text-green-400">
              {data.myRating.wins}W
            </span>
            {' / '}
            <span className="font-medium text-red-400">
              {data.myRating.losses}L
            </span>
          </span>
        </div>
      </div>
      <BattleList
        history={data.history}
        teams={data.teams}
        battleReadyCreatures={data.battleReadyCreatures}
        userId={data.userId}
        userName={session.user.name}
        userImage={session.user.image ?? null}
        dailyLimit={data.dailyLimit}
      />
    </div>
  )
}
