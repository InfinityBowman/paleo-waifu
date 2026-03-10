import { Link } from '@tanstack/react-router'
import type { updatePost } from '@paleo-waifu/shared/db/schema'
import { Badge } from '@/components/ui/badge'

type UpdatePostRow = typeof updatePost.$inferSelect

const TAG_STYLES: Record<string, string> = {
  feature: 'bg-rarity-rare/20 text-rarity-rare border-rarity-rare/30',
  balance: 'bg-rarity-epic/20 text-rarity-epic border-rarity-epic/30',
  bugfix: 'bg-destructive/10 text-destructive border-destructive/30',
  event:
    'bg-rarity-legendary/20 text-rarity-legendary border-rarity-legendary/30',
}

const TAG_LABELS: Record<string, string> = {
  feature: 'Feature',
  balance: 'Balance',
  bugfix: 'Bug Fix',
  event: 'Event',
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function stripMarkdown(md: string): string {
  return md
    .replace(/#{1,6}\s+/g, '')
    .replace(/[*_~`]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
}

export function UpdatePostList({ posts }: { posts: Array<UpdatePostRow> }) {
  if (posts.length === 0) {
    return <p className="py-12 text-center text-lavender/40">No updates yet.</p>
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => {
        const excerpt = stripMarkdown(post.body).slice(0, 200)
        return (
          <Link
            key={post.id}
            to="/updates/$postId"
            params={{ postId: post.id }}
            className="group block rounded-xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.1] hover:bg-white/[0.04]"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-lavender/40">
                {formatDate(post.publishedAt)}
              </span>
              {post.tag && (
                <Badge variant="outline" className={TAG_STYLES[post.tag] ?? ''}>
                  {TAG_LABELS[post.tag] ?? post.tag}
                </Badge>
              )}
            </div>
            <h2 className="text-lg font-semibold text-lavender-light/90 group-hover:text-primary transition-colors">
              {post.title}
            </h2>
            {excerpt && (
              <p className="mt-1 text-sm text-lavender/50 line-clamp-2">
                {excerpt}
                {post.body.length > 200 && '...'}
              </p>
            )}
          </Link>
        )
      })}
    </div>
  )
}
