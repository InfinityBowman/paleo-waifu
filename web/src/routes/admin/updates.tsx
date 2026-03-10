import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { desc } from 'drizzle-orm'
import { Newspaper, Pencil, Plus, Trash2 } from 'lucide-react'
import { createDb } from '@paleo-waifu/shared/db/client'
import { updatePost } from '@paleo-waifu/shared/db/schema'
import { requireAdminSession } from '@/lib/auth-admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { UpdatePostDialog } from '@/components/admin/UpdatePostDialog'

const getAdminUpdatePosts = createServerFn({ method: 'GET' }).handler(
  async () => {
    const { cfEnv } = await requireAdminSession()
    const db = await createDb(cfEnv.DB)
    return db
      .select()
      .from(updatePost)
      .orderBy(desc(updatePost.publishedAt))
      .all()
  },
)

export const Route = createFileRoute('/admin/updates')({
  loader: () => getAdminUpdatePosts(),
  component: AdminUpdatesPage,
})

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

function AdminUpdatesPage() {
  const posts = Route.useLoaderData()
  const router = useRouter()
  const [editingPost, setEditingPost] = useState<UpdatePostRow | null>(null)
  const [creating, setCreating] = useState(false)

  const now = Date.now()

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Updates</h1>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="h-4 w-4" />
          New Post
        </Button>
      </div>

      {posts.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          No update posts yet.
        </p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const isFuture = post.publishedAt.getTime() > now
            return (
              <Card key={post.id} className="bg-white/[0.02]">
                <CardContent className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{post.title}</span>
                      {post.tag && (
                        <Badge
                          variant="outline"
                          className={TAG_STYLES[post.tag] ?? ''}
                        >
                          {TAG_LABELS[post.tag] ?? post.tag}
                        </Badge>
                      )}
                      {isFuture && (
                        <Badge variant="outline" className="text-warning">
                          Scheduled
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {post.publishedAt.toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setEditingPost(post)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={async () => {
                        if (!confirm('Delete this post?')) return
                        await fetch('/api/updates', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            action: 'delete',
                            id: post.id,
                          }),
                        })
                        router.invalidate()
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {creating && (
        <UpdatePostDialog
          onClose={() => setCreating(false)}
          onSuccess={() => {
            setCreating(false)
            router.invalidate()
          }}
        />
      )}

      {editingPost && (
        <UpdatePostDialog
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSuccess={() => {
            setEditingPost(null)
            router.invalidate()
          }}
        />
      )}
    </div>
  )
}
