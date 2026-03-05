import { createFileRoute } from '@tanstack/react-router'
import { Hero } from '@/components/landing/Hero'

export const Route = createFileRoute('/_public/')({
  headers: () => ({
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
  }),
  head: () => ({
    meta: [
      { title: 'PaleoWaifu — Prehistoric Gacha' },
      {
        name: 'description',
        content:
          'Collect and trade 600+ waifu-fied prehistoric creatures in this gacha game. Pull fossils, discover ancient companions, and build your collection.',
      },
    ],
  }),
  component: LandingPage,
})

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Hero />
    </div>
  )
}
