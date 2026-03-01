import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { count, eq, sql } from 'drizzle-orm'
import { ArrowLeft, Coins, Dices } from 'lucide-react'
import type { Rarity } from '@/lib/types'
import { IconArchiveResearch, IconTrade } from '@/components/icons'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@/lib/db/client'
import { createAuth } from '@/lib/auth'
import {
  banner,
  creature,
  currency,
  pityCounter,
  tradeHistory,
  user,
  userCreature,
} from '@/lib/db/schema'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toCdnUrl } from '@/lib/utils'
import { RARITY_BORDER, RARITY_COLORS } from '@/lib/types'

const getAdminUserDetail = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    const cfEnv = getCfEnv()
    const auth = await createAuth(cfEnv)
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    })
    if (!session || (session.user as { role?: string }).role !== 'admin') {
      throw new Error('Forbidden')
    }

    const db = await createDb(cfEnv.DB)

    const [
      userRow,
      currencyRow,
      totalPulls,
      uniqueSpecies,
      totalSpecies,
      tradeCount,
      creatures,
      pityCounters,
    ] = await Promise.all([
      db.select().from(user).where(eq(user.id, userId)).get(),
      db.select().from(currency).where(eq(currency.userId, userId)).get(),
      db
        .select({ count: count() })
        .from(userCreature)
        .where(eq(userCreature.userId, userId))
        .get(),
      db
        .select({
          count: sql<number>`count(distinct ${userCreature.creatureId})`,
        })
        .from(userCreature)
        .where(eq(userCreature.userId, userId))
        .get(),
      db.select({ count: count() }).from(creature).get(),
      db
        .select({ count: count() })
        .from(tradeHistory)
        .where(
          sql`${tradeHistory.giverId} = ${userId} OR ${tradeHistory.receiverId} = ${userId}`,
        )
        .get(),
      db
        .select({
          id: userCreature.id,
          name: creature.name,
          rarity: creature.rarity,
          imageUrl: creature.imageUrl,
          pulledAt: userCreature.pulledAt,
        })
        .from(userCreature)
        .innerJoin(creature, eq(creature.id, userCreature.creatureId))
        .where(eq(userCreature.userId, userId))
        .orderBy(sql`${userCreature.pulledAt} DESC`)
        .limit(100)
        .all(),
      db
        .select({
          bannerName: banner.name,
          pullsSinceRare: pityCounter.pullsSinceRare,
          pullsSinceLegendary: pityCounter.pullsSinceLegendary,
          totalPulls: pityCounter.totalPulls,
        })
        .from(pityCounter)
        .innerJoin(banner, eq(banner.id, pityCounter.bannerId))
        .where(eq(pityCounter.userId, userId))
        .all(),
    ])

    if (!userRow) return null

    return {
      user: userRow,
      fossils: currencyRow?.fossils ?? 0,
      totalPulls: totalPulls?.count ?? 0,
      uniqueSpecies:
        (uniqueSpecies as { count: number } | undefined)?.count ?? 0,
      totalSpecies: totalSpecies?.count ?? 0,
      tradeCount: tradeCount?.count ?? 0,
      creatures,
      pityCounters,
    }
  })

export const Route = createFileRoute('/admin/users/$userId')({
  loader: ({ params }) => getAdminUserDetail({ data: params.userId }),
  component: UserDetailPage,
})

type IconComponent = React.ComponentType<{
  className?: string
  style?: React.CSSProperties
}>

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: IconComponent
}) {
  return (
    <Card size="sm" className="group transition-shadow hover:shadow-md">
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4" />
              {label}
            </div>
            <div className="mt-1 font-display text-2xl font-bold">{value}</div>
          </div>
          <Icon className="h-10 w-10 text-muted-foreground/10 transition-colors group-hover:text-muted-foreground/20" />
        </div>
      </CardContent>
    </Card>
  )
}

function UserDetailPage() {
  const data = Route.useLoaderData()

  if (!data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-muted-foreground">User not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/admin/users" search={{ search: '', role: 'all', page: 0 }}>
            Back to Users
          </Link>
        </Button>
      </div>
    )
  }

  const { user: u, creatures, pityCounters } = data
  const completionPct =
    data.totalSpecies > 0
      ? Math.round((data.uniqueSpecies / data.totalSpecies) * 100)
      : 0

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Button variant="ghost" size="sm" className="mb-4" asChild>
        <Link to="/admin/users" search={{ search: '', role: 'all', page: 0 }}>
          <ArrowLeft className="h-4 w-4" />
          Back to Users
        </Link>
      </Button>

      {/* User header */}
      <div className="mb-6 flex items-center gap-4">
        <Avatar className="size-16">
          {u.image ? <AvatarImage src={u.image} alt={u.name} /> : null}
          <AvatarFallback className="text-2xl font-bold">
            {u.name[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold">{u.name}</h1>
            {(u.role as string) === 'admin' && (
              <Badge variant="default">admin</Badge>
            )}
            {u.banned && <Badge variant="destructive">banned</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{u.email}</p>
          {u.banReason && (
            <p className="mt-1 text-sm text-destructive">
              Ban reason: {u.banReason}
            </p>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="collection">
            Collection ({creatures.length})
          </TabsTrigger>
          <TabsTrigger value="pity">Pity Counters</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Fossils" value={data.fossils} icon={Coins} />
            <StatCard
              label="Total Pulls"
              value={data.totalPulls}
              icon={Dices}
            />
            <Card
              size="sm"
              className="group transition-shadow hover:shadow-md sm:col-span-2"
            >
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <IconArchiveResearch className="h-4 w-4" />
                      Species Found
                    </div>
                    <div className="mt-1 font-display text-2xl font-bold">
                      {data.uniqueSpecies} / {data.totalSpecies}
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
            <StatCard label="Trades" value={data.tradeCount} icon={IconTrade} />
          </div>
        </TabsContent>

        <TabsContent value="collection" className="mt-4">
          {creatures.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No creatures collected yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {creatures.map((c) => {
                const rarity = c.rarity as Rarity
                return (
                  <Card
                    key={c.id}
                    size="sm"
                    className={`overflow-hidden border ${RARITY_BORDER[rarity]}`}
                  >
                    {c.imageUrl && (
                      <div className="aspect-3/4 overflow-hidden">
                        <img
                          src={toCdnUrl(c.imageUrl) ?? undefined}
                          alt={c.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    )}
                    <CardContent className="p-2">
                      <div className="truncate text-sm font-medium">
                        {c.name}
                      </div>
                      <div
                        className={`text-xs capitalize ${RARITY_COLORS[rarity]}`}
                      >
                        {rarity}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="pity" className="mt-4">
          {pityCounters.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No pity data yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {pityCounters.map((pc, i) => (
                <Card key={i} size="sm">
                  <CardContent>
                    <div className="font-medium">{pc.bannerName}</div>
                    <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
                      <span>Total pulls: {pc.totalPulls}</span>
                      <span>Since rare: {pc.pullsSinceRare}</span>
                      <span>Since legendary: {pc.pullsSinceLegendary}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
