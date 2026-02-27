import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { count, eq, sql } from 'drizzle-orm'
import { createDb } from '@/lib/db/client'
import { creature, currency, tradeHistory, userCreature } from '@/lib/db/schema'
import { ensureSession } from '@/lib/auth-server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'

const getProfileData = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await ensureSession()
  const db = createDb((env as unknown as Env).DB)

  const [
    currencyRow,
    totalCreatures,
    uniqueSpecies,
    totalSpeciesCount,
    tradeCount,
  ] = await Promise.all([
    db
      .select()
      .from(currency)
      .where(eq(currency.userId, session.user.id))
      .get(),
    db
      .select({ count: count() })
      .from(userCreature)
      .where(eq(userCreature.userId, session.user.id))
      .get(),
    db
      .select({
        count: sql<number>`count(distinct ${userCreature.creatureId})`,
      })
      .from(userCreature)
      .where(eq(userCreature.userId, session.user.id))
      .get(),
    db.select({ count: count() }).from(creature).get(),
    db
      .select({ count: count() })
      .from(tradeHistory)
      .where(
        sql`${tradeHistory.giverId} = ${session.user.id} OR ${tradeHistory.receiverId} = ${session.user.id}`,
      )
      .get(),
  ])

  return {
    user: session.user,
    fossils: currencyRow?.fossils ?? 0,
    totalPulls: totalCreatures?.count ?? 0,
    uniqueSpecies: (uniqueSpecies as { count: number } | undefined)?.count ?? 0,
    totalSpecies: totalSpeciesCount?.count ?? 0,
    tradeCount: tradeCount?.count ?? 0,
  }
})

export const Route = createFileRoute('/_app/profile')({
  loader: () => getProfileData(),
  component: ProfilePage,
})

function ProfilePage() {
  const { user, fossils, totalPulls, uniqueSpecies, totalSpecies, tradeCount } =
    Route.useLoaderData()

  const completionPct =
    totalSpecies > 0 ? Math.round((uniqueSpecies / totalSpecies) * 100) : 0

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-8 flex items-center gap-4">
        <Avatar className="size-16">
          {user.image ? (
            <AvatarImage src={user.image} alt={user.name} />
          ) : null}
          <AvatarFallback className="text-2xl font-bold">
            {user.name[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Fossils" value={fossils} icon="🦴" />
        <StatCard label="Total Pulls" value={totalPulls} icon="🎰" />
        <StatCard
          label="Species Found"
          value={`${uniqueSpecies} / ${totalSpecies}`}
          icon="🔬"
          subtitle={`${completionPct}% complete`}
        />
        <StatCard label="Trades" value={tradeCount} icon="🤝" />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  subtitle,
}: {
  label: string
  value: string | number
  icon: string
  subtitle?: string
}) {
  return (
    <Card size="sm">
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{icon}</span>
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold">{value}</div>
        {subtitle && (
          <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>
        )}
      </CardContent>
    </Card>
  )
}
