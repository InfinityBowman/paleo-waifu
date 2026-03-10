import { useState } from 'react'
import type { updatePost } from '@paleo-waifu/shared/db/schema'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownRenderer } from '@/components/updates/MarkdownRenderer'

type UpdatePostRow = typeof updatePost.$inferSelect

function toDatetimeLocal(date: Date): string {
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

function fromDatetimeLocal(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000)
}

export function UpdatePostDialog({
  post,
  onClose,
  onSuccess,
}: {
  post?: UpdatePostRow
  onClose: () => void
  onSuccess: () => void
}) {
  const [title, setTitle] = useState(post?.title ?? '')
  const [body, setBody] = useState(post?.body ?? '')
  const [tag, setTag] = useState<string>(post?.tag ?? 'none')
  const [publishedAt, setPublishedAt] = useState(
    toDatetimeLocal(post?.publishedAt ?? new Date()),
  )
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return

    setLoading(true)
    try {
      const payload = {
        action: post ? 'update' : 'create',
        ...(post ? { id: post.id } : {}),
        title: title.trim(),
        body: body.trim(),
        tag: tag === 'none' ? null : tag,
        publishedAt: fromDatetimeLocal(publishedAt),
      }

      const res = await fetch('/api/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        onSuccess()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{post ? 'Edit Post' : 'New Update Post'}</DialogTitle>
        <DialogDescription>
          {post
            ? 'Edit the update post details below.'
            : 'Create a new update post. Markdown is supported in the body.'}
        </DialogDescription>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Battle System Rework"
              className="mt-1"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="tag">Tag</Label>
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="feature">Feature</SelectItem>
                  <SelectItem value="balance">Balance</SelectItem>
                  <SelectItem value="bugfix">Bug Fix</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label htmlFor="publishedAt">Publish Date</Label>
              <Input
                id="publishedAt"
                type="datetime-local"
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab('write')}
                className={`text-sm font-medium transition-colors ${tab === 'write' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setTab('preview')}
                className={`text-sm font-medium transition-colors ${tab === 'preview' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Preview
              </button>
            </div>
            {tab === 'write' ? (
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your update in markdown..."
                className="min-h-48 font-mono text-xs"
              />
            ) : (
              <div className="min-h-48 rounded-lg border border-input p-3">
                {body.trim() ? (
                  <MarkdownRenderer content={body} />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nothing to preview.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim() || !body.trim()}
            >
              {loading ? 'Saving...' : post ? 'Save Changes' : 'Publish'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
