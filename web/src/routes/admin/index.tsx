import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
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
import { requireAdminSession } from '@/lib/auth-server'
import { StatCard } from '@/components/shared/StatCard'

const getAdminDashboardData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { cfEnv } = await requireAdminSession()
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
