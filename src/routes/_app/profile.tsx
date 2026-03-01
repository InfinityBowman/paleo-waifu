import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { count, eq, sql } from 'drizzle-orm'
import { Dices } from 'lucide-react'
import {
  IconArchiveResearch,
  IconDinosaurBones,
  IconTrade,
} from '@/components/icons'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@/lib/db/client'
import { creature, currency, tradeHistory, userCreature } from '@/lib/db/schema'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'

const getProfileData = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    const db = await createDb(getCfEnv().DB)

    const [
      currencyRow,
      totalCreatures,
      uniqueSpecies,
      totalSpeciesCount,
      tradeCount,
    ] = await Promise.all([
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
    ])

    return {
      fossils: currencyRow?.fossils ?? 0,
      totalPulls: totalCreatures?.count ?? 0,
      uniqueSpecies:
        (uniqueSpecies as { count: number } | undefined)?.count ?? 0,
      totalSpecies: totalSpeciesCount?.count ?? 0,
      tradeCount: tradeCount?.count ?? 0,
    }
  })

export const Route = createFileRoute('/_app/profile')({
  loader: ({ context }) => getProfileData({ data: context.session.user.id }),
  component: ProfilePage,
})

function ProfilePage() {
  const { fossils, totalPulls, uniqueSpecies, totalSpecies, tradeCount } =
    Route.useLoaderData()
  const { session } = Route.useRouteContext()
  const user = session.user

  const completionPct =
    totalSpecies > 0 ? Math.round((uniqueSpecies / totalSpecies) * 100) : 0

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
