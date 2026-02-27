import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { createDb } from '@/lib/db/client'
import { creature } from '@/lib/db/schema'
import { EncyclopediaGrid } from '@/components/encyclopedia/EncyclopediaGrid'

const getCreatures = createServerFn({ method: 'GET' }).handler(async () => {
  const db = createDb((env as unknown as Env).DB)
  return db.select().from(creature).all()
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
        <h1 className="text-3xl font-bold">Encyclopedia</h1>
        <p className="mt-2 text-muted-foreground">
          Discover prehistoric creatures from across the ages.
        </p>
      </div>
      <EncyclopediaGrid creatures={creatures} />
    </div>
  )
}
