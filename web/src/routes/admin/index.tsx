import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { count, sql } from 'drizzle-orm'
import { BarChart3, Coins, Pickaxe, Users } from 'lucide-react'
import { createDb } from '@paleo-waifu/shared/db/client'
import {
  creature,
  currency,
  tradeOffer,
  user,
  userCreature,
} from '@paleo-waifu/shared/db/schema'
import { IconTrade } from '@/components/icons'
import { getCfEnv } from '@/lib/env'
import { createAuth } from '@/lib/auth'
import { Card, CardContent } from '@/components/ui/card'

const getAdminDashboardData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const cfEnv = getCfEnv()
    const auth = await createAuth(cfEnv)
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    })
    if (!session || (session.user as { role?: string }).role !== 'admin') {
      throw new Error('Forbidden')
    }

    const db = await createDb(cfEnv.DB)

    const now = new Date()
    const startOfDay = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    )

    const [
      totalUsers,
      usersToday,
      totalFossils,
      totalPulls,
      activeTrades,
      totalCreatures,
    ] = await Promise.all([
      db.select({ count: count() }).from(user).get(),
      db
        .select({ count: count() })
        .from(user)
        .where(
          sql`${user.createdAt} >= ${Math.floor(startOfDay.getTime() / 1000)}`,
        )
        .get(),
      db
        .select({ total: sql<number>`coalesce(sum(${currency.fossils}), 0)` })
        .from(currency)
        .get(),
      db.select({ count: count() }).from(userCreature).get(),
      db
        .select({ count: count() })
        .from(tradeOffer)
        .where(sql`${tradeOffer.status} IN ('open', 'pending')`)
        .get(),
      db.select({ count: count() }).from(creature).get(),
    ])

    return {
      totalUsers: totalUsers?.count ?? 0,
      usersToday: usersToday?.count ?? 0,
      totalFossils: (totalFossils as { total: number } | undefined)?.total ?? 0,
      totalPulls: totalPulls?.count ?? 0,
      activeTrades: activeTrades?.count ?? 0,
      totalCreatures: totalCreatures?.count ?? 0,
    }
  },
)

export const Route = createFileRoute('/admin/')({
  loader: () => getAdminDashboardData(),
  staleTime: 5 * 60 * 1000,
  component: DashboardPage,
})

type IconComponent = React.ComponentType<{
  className?: string
  style?: React.CSSProperties
}>

function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string
  value: string | number
  subtitle?: string
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
            {subtitle && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {subtitle}
              </div>
            )}
          </div>
          <Icon className="h-10 w-10 text-muted-foreground/10 transition-colors group-hover:text-muted-foreground/20" />
        </div>
      </CardContent>
    </Card>
  )
}

function DashboardPage() {
  const data = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Overview of your game
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Users"
          value={data.totalUsers}
          subtitle={`${data.usersToday} joined today`}
          icon={Users}
        />
        <StatCard
          label="Total Pulls"
          value={data.totalPulls.toLocaleString()}
          icon={Pickaxe}
        />
        <StatCard
          label="Fossils in Circulation"
          value={data.totalFossils.toLocaleString()}
          icon={Coins}
        />
        <StatCard
          label="Active Trades"
          value={data.activeTrades}
          icon={IconTrade}
        />
        <StatCard
          label="Creatures in Database"
          value={data.totalCreatures}
          icon={BarChart3}
        />
      </div>
    </div>
  )
}
