import { useEffect, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { Bone, CalendarCheck, Gift } from 'lucide-react'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@/lib/db/client'
import { banner, currency } from '@/lib/db/schema'
import { getSession } from '@/lib/auth-server'
import { ensureUserCurrency, getFossils } from '@/lib/gacha'
import { DAILY_FOSSILS } from '@/lib/types'
import { useAppStore } from '@/store/appStore'
import { PullButton } from '@/components/gacha/PullButton'
import { PullAnimation } from '@/components/gacha/PullAnimation'
import { PityCounter } from '@/components/gacha/PityCounter'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const getGachaData = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await getSession()
  if (!session) throw redirect({ to: '/' })
  const userId = session.user.id
  const db = await createDb(getCfEnv().DB)

  await ensureUserCurrency(db, userId)

  const [banners, fossils, currencyRow] = await Promise.all([
    db.select().from(banner).where(eq(banner.isActive, true)).all(),
    getFossils(db, userId),
    db
      .select({ lastDailyClaim: currency.lastDailyClaim })
      .from(currency)
      .where(eq(currency.userId, userId))
      .get(),
  ])

  const now = Math.floor(Date.now() / 1000)
  const startOfDay = now - (now % 86400)
  const lastClaim = currencyRow?.lastDailyClaim
    ? Math.floor(currencyRow.lastDailyClaim.getTime() / 1000)
    : 0
  const canClaimDaily = lastClaim < startOfDay

  const activeBannerId = banners[0]?.id ?? null

  return { activeBannerId, fossils, canClaimDaily }
})

export const Route = createFileRoute('/_app/gacha')({
  loader: () => getGachaData(),
  component: GachaPage,
})

function GachaPage() {
  const {
    activeBannerId,
    fossils: initialFossils,
    canClaimDaily: initialCanClaim,
  } = Route.useLoaderData()
  const storeFossils = useAppStore((s) => s.fossils)
  const setFossils = useAppStore((s) => s.setFossils)
  const [canClaim, setCanClaim] = useState(initialCanClaim)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    setFossils(initialFossils)
  }, [initialFossils, setFossils])

  const displayFossils = storeFossils ?? initialFossils

  const handleClaimDaily = async () => {
    setClaiming(true)
    try {
      const res = await fetch('/api/gacha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'claim_daily' }),
      })
      const data = (await res.json()) as {
        claimed?: boolean
        fossils?: number
      }
      if (data.claimed) {
        if (data.fossils != null) setFossils(data.fossils)
        setCanClaim(false)
      }
    } catch {
      // Silently fail — user can retry
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Gacha</h1>
          <p className="mt-1 text-muted-foreground">
            Excavate fossils to discover prehistoric waifus!
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canClaim ? (
            <Button
              onClick={handleClaimDaily}
              disabled={claiming}
              variant="outline"
              className="group border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20"
            >
              <Gift className="h-4 w-4 transition-transform group-hover:rotate-12" />
              <span className="font-display">Claim +{DAILY_FOSSILS}</span>
              <Bone className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-md border border-border/50 px-3 py-2 text-xs text-muted-foreground">
              <CalendarCheck className="h-3.5 w-3.5" />
              Daily claimed
            </div>
          )}
          <Card
            size="sm"
            className="flex-row items-center gap-2 border-primary/20 bg-gradient-to-r from-primary/5 to-amber-400/5 px-5 py-3"
          >
            <Bone className="h-6 w-6 text-primary/70" />
            <span className="font-display text-2xl font-bold text-primary">
              {displayFossils}
            </span>
            <span className="text-sm text-muted-foreground">Fossils</span>
          </Card>
        </div>
      </div>

      {!activeBannerId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg text-muted-foreground">
              No active banners right now. Check back soon!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <PullAnimation />
          <div className="flex items-center justify-between gap-4">
            <PityCounter />
            <PullButton bannerId={activeBannerId} />
          </div>
        </div>
      )}
    </div>
  )
}
