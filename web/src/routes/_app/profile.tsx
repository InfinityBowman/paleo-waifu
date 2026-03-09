import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { count, eq, sql } from 'drizzle-orm'
import { Dices, Swords } from 'lucide-react'
import { createDb } from '@paleo-waifu/shared/db/client'
import {
  battleRating,
  creature,
  currency,
  tradeHistory,
  userCreature,
  userXp,
} from '@paleo-waifu/shared/db/schema'
import { calcXpProgress, xpToNextLevel } from '@paleo-waifu/shared/xp'
import { getCfEnv } from '@/lib/env'
import { getArenaTier } from '@/lib/battle'
import { countDistinctSpecies } from '@/lib/queries'
import {
  IconArchiveResearch,
  IconCrystalCluster,
  IconDinosaurBones,
  IconTrade,
} from '@/components/icons'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { StatCard } from '@/components/shared/StatCard'

const getProfileData = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    const db = await createDb(getCfEnv().DB)

    const [
      currencyRow,
      totalCreatures,
      uniqueSpeciesCount,
      totalSpeciesCount,
      tradeCount,
      xpRow,
      ratingRow,
    ] = await Promise.all([
      db.select().from(currency).where(eq(currency.userId, userId)).get(),
      db
        .select({ count: count() })
        .from(userCreature)
        .where(eq(userCreature.userId, userId))
        .get(),
      countDistinctSpecies(db, userId),
      db.select({ count: count() }).from(creature).get(),
      db
        .select({ count: count() })
        .from(tradeHistory)
        .where(
          sql`${tradeHistory.giverId} = ${userId} OR ${tradeHistory.receiverId} = ${userId}`,
        )
        .get(),
      db
        .select({ xp: userXp.xp, level: userXp.level })
        .from(userXp)
        .where(eq(userXp.userId, userId))
        .get(),
      db
        .select()
        .from(battleRating)
        .where(eq(battleRating.userId, userId))
        .get(),
    ])

    const rating = ratingRow?.rating ?? 0
    return {
      fossils: currencyRow?.fossils ?? 0,
      totalPulls: totalCreatures?.count ?? 0,
      uniqueSpecies: uniqueSpeciesCount,
      totalSpecies: totalSpeciesCount?.count ?? 0,
      tradeCount: tradeCount?.count ?? 0,
      xp: xpRow?.xp ?? 0,
      level: xpRow?.level ?? 0,
      arenaRating: rating,
      arenaTier: getArenaTier(rating),
      arenaWins: ratingRow?.wins ?? 0,
      arenaLosses: ratingRow?.losses ?? 0,
    }
  })

export const Route = createFileRoute('/_app/profile')({
  loader: ({ context }) => getProfileData({ data: context.session.user.id }),
  component: ProfilePage,
})

function ProfilePage() {
  const {
    fossils,
    totalPulls,
    uniqueSpecies,
    totalSpecies,
    tradeCount,
    xp,
    level,
    arenaRating,
    arenaTier,
    arenaWins,
    arenaLosses,
  } = Route.useLoaderData()
  const { session } = Route.useRouteContext()
  const user = session.user

  const completionPct =
    totalSpecies > 0 ? Math.round((uniqueSpecies / totalSpecies) * 100) : 0

  const xpProgress = calcXpProgress(xp, level)
  const xpToNext = xpToNextLevel(xp)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 lg:max-w-4xl">
      <div className="mb-8 flex items-center gap-4">
        <Avatar className="size-16">
          {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
          <AvatarFallback className="text-2xl font-bold">
            {user.name[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-display text-2xl font-bold">{user.name}</h1>
        </div>
      </div>

      <Card size="sm" className="group mb-6 transition-shadow hover:shadow-md">
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconCrystalCluster className="h-4 w-4" />
                Discord Level
              </div>
              <div className="mt-1 font-display text-2xl font-bold">
                Level {level}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {xp.toLocaleString()} XP total &middot;{' '}
                {xpToNext.toLocaleString()} XP to next level
              </div>
            </div>
            <IconCrystalCluster className="h-10 w-10 text-muted-foreground/10 transition-colors group-hover:text-muted-foreground/20" />
          </div>
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-rarity-epic/80 transition-all duration-500"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card size="sm" className="group mb-6 transition-shadow hover:shadow-md">
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Swords className="h-4 w-4" />
                Arena
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold">
                  {arenaTier}
                </span>
                <span className="text-sm text-muted-foreground">
                  {arenaRating} Rating
                </span>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                <span className="font-medium text-green-400">
                  {arenaWins}W
                </span>
                {' / '}
                <span className="font-medium text-red-400">
                  {arenaLosses}L
                </span>
                {arenaWins + arenaLosses > 0 && (
                  <span className="ml-1.5">
                    &middot;{' '}
                    {Math.round(
                      (arenaWins / (arenaWins + arenaLosses)) * 100,
                    )}
                    % win rate
                  </span>
                )}
              </div>
            </div>
            <Swords className="h-10 w-10 text-muted-foreground/10 transition-colors group-hover:text-muted-foreground/20" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Fossils" value={fossils} icon={IconDinosaurBones} />
        <StatCard label="Total Pulls" value={totalPulls} icon={Dices} />
        <Card
          size="sm"
          className="group transition-shadow hover:shadow-md sm:col-span-2 lg:col-span-3"
        >
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <IconArchiveResearch className="h-4 w-4" />
                  Species Found
                </div>
                <div className="mt-1 font-display text-2xl font-bold">
                  {uniqueSpecies} / {totalSpecies}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {completionPct}% complete
                </div>
              </div>
              <IconArchiveResearch className="h-10 w-10 text-muted-foreground/10 transition-colors group-hover:text-muted-foreground/20" />
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-rarity-epic/80 transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <StatCard label="Trades" value={tradeCount} icon={IconTrade} />
      </div>
    </div>
  )
}
