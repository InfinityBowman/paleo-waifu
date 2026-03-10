import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { getCreatureBySlug } from '@/routes/_public/encyclopedia'
import { CreatureDetail } from '@/components/encyclopedia/CreatureDetail'

export const Route = createFileRoute('/_public/encyclopedia_/$creatureSlug')({
  loader: async ({ params }) => {
    const creature = await getCreatureBySlug({ data: params.creatureSlug })
    if (!creature) throw notFound()
    return creature
  },
  headers: () => ({
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  }),
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    return {
      meta: [
        {
          title: `${loaderData.name} — PaleoWaifu Encyclopedia`,
        },
        {
          name: 'description',
          content: loaderData.description.slice(0, 160),
        },
        {
          property: 'og:title',
          content: `${loaderData.name} — PaleoWaifu Encyclopedia`,
        },
        {
          property: 'og:description',
          content: loaderData.description.slice(0, 160),
        },
        ...(loaderData.imageUrl
          ? [{ property: 'og:image', content: loaderData.imageUrl }]
          : []),
        {
          property: 'og:url',
          content: `https://paleowaifu.com/encyclopedia/${loaderData.slug}`,
        },
        { name: 'twitter:card', content: 'summary_large_image' },
        {
          name: 'twitter:title',
          content: `${loaderData.name} — PaleoWaifu Encyclopedia`,
        },
        {
          name: 'twitter:description',
          content: loaderData.description.slice(0, 160),
        },
        ...(loaderData.imageUrl
          ? [{ name: 'twitter:image', content: loaderData.imageUrl }]
          : []),
      ],
    }
  },
  component: CreaturePage,
  notFoundComponent: () => (
    <div className="py-20 text-center text-lavender/40">
      Creature not found.
    </div>
  ),
})

function CreaturePage() {
  const creature = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        to="/encyclopedia"
        className="mb-6 inline-flex items-center gap-1 text-sm text-lavender/50 transition-colors hover:text-lavender/80"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Encyclopedia
      </Link>
      <CreatureDetail creature={creature} />
    </div>
  )
}
