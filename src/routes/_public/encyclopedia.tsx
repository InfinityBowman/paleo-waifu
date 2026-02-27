import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@/lib/db/client'
import { creature } from '@/lib/db/schema'
import { EncyclopediaGrid } from '@/components/encyclopedia/EncyclopediaGrid'

const getCreatures = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await createDb(getCfEnv().DB)
  return db
    .select({
      id: creature.id,
      name: creature.name,
      scientificName: creature.scientificName,
      era: creature.era,
      diet: creature.diet,
      rarity: creature.rarity,
      imageUrl: creature.imageUrl,
      imageAspectRatio: creature.imageAspectRatio,
    })
    .from(creature)
    .all()
})

export const getCreatureDetails = createServerFn({ method: 'GET' })
  .inputValidator((id: string) => id)
  .handler(async ({ data: id }) => {
    const db = await createDb(getCfEnv().DB)
    const rows = await db
      .select({
        description: creature.description,
        period: creature.period,
        sizeMeters: creature.sizeMeters,
        weightKg: creature.weightKg,
        funFacts: creature.funFacts,
      })
      .from(creature)
      .where(eq(creature.id, id))
    return rows[0] ?? null
  })

export const Route = createFileRoute('/_public/encyclopedia')({
  loader: () => getCreatures(),
  component: EncyclopediaPage,
})

function EncyclopediaPage() {
  const creatures = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Encyclopedia</h1>
        <p className="mt-2 text-muted-foreground">
          Discover prehistoric creatures from across the ages.
        </p>
      </div>
      <EncyclopediaGrid creatures={creatures} />
    </div>
  )
}
