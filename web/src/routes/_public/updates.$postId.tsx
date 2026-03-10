import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { ArrowLeft } from 'lucide-react'
import { createDb } from '@paleo-waifu/shared/db/client'
import { updatePost } from '@paleo-waifu/shared/db/schema'
import { getCfEnv } from '@/lib/env'
import { UpdatePostCard } from '@/components/updates/UpdatePostCard'

const getUpdatePost = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: postId }) => {
    const db = await createDb(getCfEnv().DB)
    const post = await db
      .select()
      .from(updatePost)
      .where(eq(updatePost.id, postId))
      .get()
    if (!post) return null
    if (post.publishedAt.getTime() > Date.now()) return null
    return post
  })

export const Route = createFileRoute('/_public/updates/$postId')({
  loader: async ({ params }) => {
    const post = await getUpdatePost({ data: params.postId })
    if (!post) throw notFound()
    return post
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    return {
      meta: [
        { title: `${loaderData.title} — PaleoWaifu Updates` },
        {
          name: 'description',
          content: loaderData.body.slice(0, 160),
        },
      ],
    }
  },
  component: UpdatePostPage,
  notFoundComponent: () => (
    <div className="py-20 text-center text-lavender/40">Update not found.</div>
  ),
})

function UpdatePostPage() {
  const post = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        to="/updates"
        className="mb-6 inline-flex items-center gap-1 text-sm text-lavender/50 transition-colors hover:text-lavender/80"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Updates
      </Link>
      <UpdatePostCard post={post} />
    </div>
  )
}
