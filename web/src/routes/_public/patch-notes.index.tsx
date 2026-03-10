import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Newspaper } from 'lucide-react'
import { getAllUpdatePosts } from '@/lib/updates'
import { UpdatePostList } from '@/components/updates/UpdatePostList'

const getUpdatePosts = createServerFn({ method: 'GET' }).handler(async () => {
  return getAllUpdatePosts()
})

export const Route = createFileRoute('/_public/patch-notes/')({
  headers: () => ({
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  }),
  head: () => ({
    meta: [
      { title: 'Patch Notes — PaleoWaifu' },
      {
        name: 'description',
        content:
          'Latest patch notes for PaleoWaifu. See new features, balance changes, bug fixes, and events.',
      },
    ],
  }),
  loader: () => getUpdatePosts(),
  component: UpdatesPage,
})

function UpdatesPage() {
  const posts = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-primary" />
        <h1 className="font-display text-2xl font-bold">Patch Notes</h1>
      </div>
      <UpdatePostList posts={posts} />
    </div>
  )
}
