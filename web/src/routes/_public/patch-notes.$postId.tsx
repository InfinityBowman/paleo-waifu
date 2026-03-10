import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { ArrowLeft } from 'lucide-react'
import { getUpdatePost } from '@/lib/updates'
import { UpdatePostCard } from '@/components/updates/UpdatePostCard'

const fetchUpdatePost = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(({ data: postId }) => {
    return getUpdatePost(postId)
  })

export const Route = createFileRoute('/_public/patch-notes/$postId')({
  loader: async ({ params }) => {
    const post = await fetchUpdatePost({ data: params.postId })
    if (!post) throw notFound()
    return post
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {}
    return {
      meta: [
        { title: `${loaderData.title} — PaleoWaifu Patch Notes` },
        {
          name: 'description',
          content: loaderData.body.slice(0, 160),
        },
      ],
    }
  },
  component: UpdatePostPage,
  notFoundComponent: () => (
    <div className="py-20 text-center text-lavender/40">
      Patch note not found.
    </div>
  ),
})

function UpdatePostPage() {
  const post = Route.useLoaderData()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        to="/patch-notes"
        className="mb-6 inline-flex items-center gap-1 text-sm text-lavender/50 transition-colors hover:text-lavender/80"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All Patch Notes
      </Link>
      <UpdatePostCard post={post} />
    </div>
  )
}
