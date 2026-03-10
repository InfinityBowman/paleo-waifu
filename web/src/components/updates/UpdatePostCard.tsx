import { MarkdownRenderer } from './MarkdownRenderer'
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

export function UpdatePostCard({ post }: { post: UpdatePostRow }) {
  return (
    <article>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xs text-lavender/40">
          {formatDate(post.publishedAt)}
        </span>
        {post.tag && (
          <Badge variant="outline" className={TAG_STYLES[post.tag] ?? ''}>
            {TAG_LABELS[post.tag] ?? post.tag}
          </Badge>
        )}
      </div>
      <h1 className="text-2xl font-bold text-lavender-light/90">
        {post.title}
      </h1>
      <MarkdownRenderer content={post.body} className="mt-4" />
    </article>
  )
}
