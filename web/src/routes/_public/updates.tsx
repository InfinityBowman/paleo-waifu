import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { desc, sql } from 'drizzle-orm'
import { Newspaper } from 'lucide-react'
import { createDb } from '@paleo-waifu/shared/db/client'
import { updatePost } from '@paleo-waifu/shared/db/schema'
import { getCfEnv } from '@/lib/env'
import { UpdatePostList } from '@/components/updates/UpdatePostList'

const getUpdatePosts = createServerFn({ method: 'GET' }).handler(async () => {
  const db = await createDb(getCfEnv().DB)
  return db
    .select()
    .from(updatePost)
    .where(sql`${updatePost.publishedAt} <= unixepoch()`)
    .orderBy(desc(updatePost.publishedAt))
    .all()
})

export const Route = createFileRoute('/_public/updates')({
  headers: () => ({
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
  }),
  head: () => ({
    meta: [
      { title: 'Updates — PaleoWaifu' },
      {
        name: 'description',
        content:
          'Latest patch notes and updates for PaleoWaifu. See new features, balance changes, bug fixes, and events.',
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
        <h1 className="font-display text-2xl font-bold">Updates</h1>
      </div>
      <UpdatePostList posts={posts} />
    </div>
  )
}
