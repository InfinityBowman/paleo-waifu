export type UpdatePost = {
  id: string
  title: string
  body: string
  tag: string | null
  publishedAt: Date
}

const modules: Record<string, string> = import.meta.glob(
  '../../content/updates/*.md',
  {
    query: '?raw',
    import: 'default',
    eager: true,
  },
)

function parseFrontmatter(raw: string): {
  meta: Record<string, string>
  body: string
} {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)
  if (!match) return { meta: {}, body: raw }

  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    meta[key] = value
  }

  return { meta, body: match[2].trim() }
}

function slugFromPath(path: string): string {
  return path.split('/').pop()!.replace(/\.md$/, '')
}

let _posts: Array<UpdatePost> | null = null

function loadPosts(): Array<UpdatePost> {
  if (_posts) return _posts

  const posts: Array<UpdatePost> = []
  for (const [path, raw] of Object.entries(modules)) {
    const { meta, body } = parseFrontmatter(raw)
    posts.push({
      id: slugFromPath(path),
      title: meta.title || 'Untitled',
      body,
      tag: meta.tag || null,
      publishedAt: new Date(meta.publishedAt),
    })
  }

  posts.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
  _posts = posts
  return posts
}

export function getAllUpdatePosts(): Array<UpdatePost> {
  const now = Date.now()
  return loadPosts().filter((p) => p.publishedAt.getTime() <= now)
}

export function getUpdatePost(id: string): UpdatePost | null {
  const post = loadPosts().find((p) => p.id === id)
  if (!post) return null
  if (post.publishedAt.getTime() > Date.now()) return null
  return post
}
