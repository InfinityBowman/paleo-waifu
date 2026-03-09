import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { desc, eq, like, or } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { createDb } from '@paleo-waifu/shared/db/client'
import {
  battleChallenge,
  battleRating,
  battleTeamPreset,
  creature,
  creatureBattleStats,
  user,
  userCreature,
} from '@paleo-waifu/shared/db/schema'
import { getCfEnv } from '@/lib/env'
import { toCdnUrl } from '@/lib/utils'
import { expireStaleChallenges, getArenaTier } from '@/lib/battle'
import { BattleList } from '@/components/battle/BattleList'

export const searchUsers = createServerFn({ method: 'GET' })
  .inputValidator((d: { query: string; excludeId: string }) => d)
  .handler(async ({ data: { query, excludeId } }) => {
    if (!query || query.length < 2) return []
    const cfEnv = getCfEnv()
    // Auth check — prevent unauthenticated user enumeration
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

const getBattleData = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    const db = await createDb(getCfEnv().DB)

    await expireStaleChallenges(db)

    const challengerUser = alias(user, 'challenger_user')
    const defenderUser = alias(user, 'defender_user')

    const [challenges, presets, battleReadyCreatures, myRating] =
      await Promise.all([
        // All challenges involving this user
        db
          .select({
            id: battleChallenge.id,
            challengerId: battleChallenge.challengerId,
            challengerName: challengerUser.name,
            challengerImage: challengerUser.image,
            defenderId: battleChallenge.defenderId,
            defenderName: defenderUser.name,
            defenderImage: defenderUser.image,
            status: battleChallenge.status,
            winnerId: battleChallenge.winnerId,
            createdAt: battleChallenge.createdAt,
            resolvedAt: battleChallenge.resolvedAt,
          })
          .from(battleChallenge)
          .innerJoin(
            challengerUser,
            eq(challengerUser.id, battleChallenge.challengerId),
          )
          .innerJoin(
            defenderUser,
            eq(defenderUser.id, battleChallenge.defenderId),
          )
          .where(
            or(
              eq(battleChallenge.challengerId, userId),
              eq(battleChallenge.defenderId, userId),
            ),
          )
          .orderBy(desc(battleChallenge.createdAt))
          .limit(50)
          .all(),

        // Team presets
        db
          .select({
            id: battleTeamPreset.id,
            name: battleTeamPreset.name,
            members: battleTeamPreset.members,
            createdAt: battleTeamPreset.createdAt,
            updatedAt: battleTeamPreset.updatedAt,
          })
          .from(battleTeamPreset)
          .where(eq(battleTeamPreset.userId, userId))
          .all(),

        // Battle-ready creatures (inner join on creatureBattleStats filters to battle-ready only)
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
      ])

    const incoming = challenges.filter(
      (c) => c.status === 'pending' && c.defenderId === userId,
    )
    const outgoing = challenges.filter(
      (c) => c.status === 'pending' && c.challengerId === userId,
    )
    const history = challenges.filter((c) => c.status !== 'pending')

    return {
      incoming,
      outgoing,
      history,
      presets: presets.map((p) => ({
        ...p,
        members: JSON.parse(p.members) as Array<{
          userCreatureId: string
          row: 'front' | 'back'
        }>,
      })),
      battleReadyCreatures: battleReadyCreatures.map((c) => ({
        ...c,
        imageUrl: toCdnUrl(c.imageUrl),
      })),
      userId,
      myRating: myRating
        ? {
            rating: myRating.rating,
            wins: myRating.wins,
            losses: myRating.losses,
            tier: getArenaTier(myRating.rating),
          }
        : { rating: 0, wins: 0, losses: 0, tier: 'Bronze' },
    }
  })

export const Route = createFileRoute('/_app/battle')({
  loader: ({ context }) => getBattleData({ data: context.session.user.id }),
  component: BattlePage,
})

function BattlePage() {
  const data = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 2xl:max-w-400">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Arena</h1>
        <p className="mt-2 text-muted-foreground">
          Challenge other players to battle with your prehistoric team.
        </p>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <span className="font-semibold">
            {data.myRating.tier} — {data.myRating.rating} Rating
          </span>
          <span className="text-muted-foreground">
            {data.myRating.wins}W / {data.myRating.losses}L
          </span>
        </div>
      </div>
      <BattleList
        incoming={data.incoming}
        outgoing={data.outgoing}
        history={data.history}
        presets={data.presets}
        battleReadyCreatures={data.battleReadyCreatures}
        userId={data.userId}
      />
    </div>
  )
}
