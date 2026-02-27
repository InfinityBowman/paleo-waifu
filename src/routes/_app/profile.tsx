import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { count, eq, sql } from 'drizzle-orm'
import { Bone, Dices, Handshake, Microscope } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
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

  const { email: _email, ...safeUser } = session.user
  return {
    user: safeUser,
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
          {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
          <AvatarFallback className="text-2xl font-bold">
            {user.name[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="font-display text-2xl font-bold">{user.name}</h1>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Fossils" value={fossils} icon={Bone} />
        <StatCard label="Total Pulls" value={totalPulls} icon={Dices} />
        <Card
          size="sm"
          className="group transition-shadow hover:shadow-md sm:col-span-2"
        >
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Microscope className="h-4 w-4" />
                  Species Found
                </div>
                <div className="mt-1 font-display text-2xl font-bold">
                  {uniqueSpecies} / {totalSpecies}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {completionPct}% complete
                </div>
              </div>
              <Microscope className="h-10 w-10 text-muted-foreground/10 transition-colors group-hover:text-muted-foreground/20" />
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 transition-all duration-500"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </CardContent>
        </Card>
        <StatCard label="Trades" value={tradeCount} icon={Handshake} />
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: LucideIcon
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
