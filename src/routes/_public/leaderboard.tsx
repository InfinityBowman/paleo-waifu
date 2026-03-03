import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { asc, count, desc, eq, sql } from 'drizzle-orm'
import { IconCrown } from '@/components/icons'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@/lib/db/client'
import { creature, user, userCreature, userXp } from '@/lib/db/schema'
import { xpForLevel } from '@/lib/xp-config'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// ─── Server function ──────────────────────────────────────────────────────────

const getLeaderboardData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const db = await createDb(getCfEnv().DB)

    const [xpRows, collectionRows, totalSpeciesRow] = await Promise.all([
      db
        .select({
          id: user.id,
          name: user.name,
          image: user.image,
          xp: userXp.xp,
          level: userXp.level,
        })
        .from(userXp)
        .innerJoin(user, eq(userXp.userId, user.id))
        .orderBy(desc(userXp.level), desc(userXp.xp))
        .limit(10),
      db
        .select({
          id: user.id,
          name: user.name,
          image: user.image,
          uniqueSpecies:
            sql<number>`count(distinct ${userCreature.creatureId})`.as(
              'unique_species',
            ),
          totalCreatures: count().as('total_creatures'),
        })
        .from(userCreature)
        .innerJoin(user, eq(userCreature.userId, user.id))
        .groupBy(userCreature.userId)
        .orderBy(
          desc(sql`count(distinct ${userCreature.creatureId})`),
          desc(count()),
          asc(user.id),
        )
        .limit(10),
      db.select({ count: count() }).from(creature).get(),
    ])

    return {
      xp: xpRows,
      collection: collectionRows,
      totalSpecies: totalSpeciesRow?.count ?? 0,
    }
  },
)

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/_public/leaderboard')({
  headers: () => ({
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  }),
  head: () => ({
    meta: [
      { title: 'Leaderboard — PaleoWaifu' },
      {
        name: 'description',
        content:
          'See who leads the PaleoWaifu rankings. Top players by XP level and creature collection size.',
      },
    ],
  }),
  loader: () => getLeaderboardData(),
  component: LeaderboardPage,
})

// ─── Component ────────────────────────────────────────────────────────────────

const RANK_STYLES: Record<number, string> = {
  1: 'text-yellow-400',
  2: 'text-zinc-300',
  3: 'text-amber-600',
}

function LeaderboardPage() {
  const { xp, collection, totalSpecies } = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8">
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold">
          <IconCrown className="h-7 w-7 text-primary" />
          Leaderboard
        </h1>
        <p className="mt-2 text-muted-foreground">
          Top players by XP level and collection completion.
        </p>
      </div>

      <Tabs defaultValue="xp">
        <TabsList variant="glass">
          <TabsTrigger value="xp">XP Level</TabsTrigger>
          <TabsTrigger value="collection">Collection</TabsTrigger>
        </TabsList>

        <TabsContent value="xp">
          {xp.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              No players yet.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {xp.map((entry, i) => {
                const rank = i + 1
                const currentLevelXp = xpForLevel(entry.level)
                const nextLevelXp = xpForLevel(entry.level + 1)
                const progress =
                  nextLevelXp > currentLevelXp
                    ? Math.min(
                        100,
                        Math.max(
                          0,
                          Math.round(
                            ((entry.xp - currentLevelXp) /
                              (nextLevelXp - currentLevelXp)) *
                              100,
                          ),
                        ),
                      )
                    : 100

                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <span
                      className={`w-6 text-center font-display text-lg font-bold ${RANK_STYLES[rank] ?? 'text-muted-foreground'}`}
                    >
                      {rank}
                    </span>
                    <Avatar size="sm">
                      {entry.image ? (
                        <AvatarImage src={entry.image} alt={entry.name} />
                      ) : null}
                      <AvatarFallback>
                        {entry.name[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">
                          {entry.name}
                        </span>
                        <span className="shrink-0 font-display text-sm font-bold">
                          Level {entry.level}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-primary to-rarity-epic/80 transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {entry.xp.toLocaleString()} XP
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="collection">
          {collection.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              No players yet.
            </p>
          ) : (
            <div className="mt-4 space-y-2">
              {collection.map((entry, i) => {
                const rank = i + 1
                const pct =
                  totalSpecies > 0
                    ? Math.round((entry.uniqueSpecies / totalSpecies) * 100)
                    : 0

                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <span
                      className={`w-6 text-center font-display text-lg font-bold ${RANK_STYLES[rank] ?? 'text-muted-foreground'}`}
                    >
                      {rank}
                    </span>
                    <Avatar size="sm">
                      {entry.image ? (
                        <AvatarImage src={entry.image} alt={entry.name} />
                      ) : null}
                      <AvatarFallback>
                        {entry.name[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">
                          {entry.name}
                        </span>
                        <span className="shrink-0 font-display text-sm font-bold">
                          {entry.uniqueSpecies}/{totalSpecies} species
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-linear-to-r from-primary to-rarity-epic/80 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {pct}% &middot; {entry.totalCreatures} total
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
