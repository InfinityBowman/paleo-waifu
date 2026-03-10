import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { getUpdatePost } from '@/lib/updates'
import { UpdatePostCard } from '@/components/updates/UpdatePostCard'

export const Route = createFileRoute('/_public/updates/$postId')({
  loader: ({ params }) => {
    const post = getUpdatePost(params.postId)
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
