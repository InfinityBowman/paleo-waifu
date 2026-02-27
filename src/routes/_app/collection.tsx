import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@/lib/db/client'
import { creature, userCreature } from '@/lib/db/schema'
import { ensureSession } from '@/lib/auth-server'
import { CollectionGrid } from '@/components/collection/CollectionGrid'

const getCollection = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await ensureSession()
  const db = await createDb(getCfEnv().DB)

  const owned = await db
    .select({
      id: userCreature.id,
      creatureId: userCreature.creatureId,
      pulledAt: userCreature.pulledAt,
      isFavorite: userCreature.isFavorite,
      isLocked: userCreature.isLocked,
      name: creature.name,
      scientificName: creature.scientificName,
      rarity: creature.rarity,
      era: creature.era,
      diet: creature.diet,
      imageUrl: creature.imageUrl,
      description: creature.description,
    })
    .from(userCreature)
    .innerJoin(creature, eq(creature.id, userCreature.creatureId))
    .where(eq(userCreature.userId, session.user.id))
    .all()

  return owned
})

export const Route = createFileRoute('/_app/collection')({
  loader: () => getCollection(),
  component: CollectionPage,
})

function CollectionPage() {
  const collection = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">My Collection</h1>
        <p className="mt-2 text-muted-foreground">
          {collection.length} creature{collection.length !== 1 ? 's' : ''}{' '}
          discovered
        </p>
      </div>
      <CollectionGrid collection={collection} />
    </div>
  )
}
