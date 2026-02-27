import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { createDb } from '@/lib/db/client'
import { banner } from '@/lib/db/schema'
import { ensureSession } from '@/lib/auth-server'
import { ensureUserCurrency, getFossils } from '@/lib/gacha'
import { useAppStore } from '@/store/appStore'
import { BannerSelect } from '@/components/gacha/BannerSelect'
import { PullButton } from '@/components/gacha/PullButton'
import { PullAnimation } from '@/components/gacha/PullAnimation'
import { PityCounter } from '@/components/gacha/PityCounter'
import { Card, CardContent } from '@/components/ui/card'

const getGachaData = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await ensureSession()
  const db = createDb((env as unknown as Env).DB)

  // Ensure user has currency row (grants new user bonus)
  await ensureUserCurrency(db, session.user.id)

  const [banners, fossils] = await Promise.all([
    db.select().from(banner).where(eq(banner.isActive, true)).all(),
    getFossils(db, session.user.id),
  ])

  return { banners, fossils, userId: session.user.id }
})

export const Route = createFileRoute('/_app/gacha')({
  loader: () => getGachaData(),
  component: GachaPage,
})

function GachaPage() {
  const { banners, fossils: initialFossils } = Route.useLoaderData()
  const [selectedBannerId, setSelectedBannerId] = useState(banners[0]?.id ?? '')
  const storeFossils = useAppStore((s) => s.fossils)
  const setFossils = useAppStore((s) => s.setFossils)

  // Initialize store with loader data
  useEffect(() => {
    setFossils(initialFossils)
  }, [initialFossils, setFossils])

  const displayFossils = storeFossils || initialFossils

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gacha</h1>
          <p className="mt-1 text-muted-foreground">
            Excavate fossils to discover prehistoric waifus!
          </p>
        </div>
        <Card size="sm" className="flex-row items-center px-4 py-2">
          <span className="text-lg">🦴</span>
          <span className="text-xl font-bold">{displayFossils}</span>
          <span className="text-sm text-muted-foreground">Fossils</span>
        </Card>
      </div>

      {banners.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-lg text-muted-foreground">
              No active banners right now. Check back soon!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <BannerSelect
            banners={banners}
            selectedId={selectedBannerId}
            onSelect={setSelectedBannerId}
          />
          <PullAnimation />
          <div className="flex items-center justify-between gap-4">
            <PityCounter />
            <PullButton bannerId={selectedBannerId} />
          </div>
        </div>
      )}
    </div>
  )
}
