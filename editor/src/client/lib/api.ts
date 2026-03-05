import type { Creature, Stats } from './types'

const BASE = '/api'

export async function fetchMe(): Promise<{
  user: { id: string; name: string; image: string | null; role: string }
} | null> {
  const res = await fetch(`${BASE}/me`, { credentials: 'include' })
  if (!res.ok) return null
  return res.json()
}

export async function logout(): Promise<void> {
  await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })
}

export async function fetchCreatures(): Promise<{
  creatures: Array<Creature>
  stats: Stats
}> {
  const res = await fetch(`${BASE}/creatures`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to fetch creatures')
  return res.json()
}

export async function fetchCreature(
  slug: string,
): Promise<{ creature: Creature }> {
  const res = await fetch(`${BASE}/creatures/${slug}`, {
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to fetch creature')
  return res.json()
}

export async function createCreature(
  data: Partial<Creature>,
): Promise<{ creature: Creature }> {
  const res = await fetch(`${BASE}/creatures`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!res.ok) {
    const body = (await res.json()) as { error?: string }
    throw new Error(body.error || 'Failed to create creature')
  }
  return res.json()
}

export async function updateCreature(
  slug: string,
  data: Partial<Creature>,
): Promise<{ creature: Creature }> {
  const res = await fetch(`${BASE}/creatures/${slug}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
    credentials: 'include',
  })
  if (!res.ok) {
    const body = (await res.json()) as { error?: string }
    throw new Error(body.error || 'Failed to update creature')
  }
  return res.json()
}

export async function deleteCreature(
  slug: string,
  deleteImage = false,
): Promise<void> {
  const url = deleteImage
    ? `${BASE}/creatures/${slug}?deleteImage=true`
    : `${BASE}/creatures/${slug}`
  const res = await fetch(url, { method: 'DELETE', credentials: 'include' })
  if (!res.ok) throw new Error('Failed to delete creature')
}

export async function uploadImage(
  slug: string,
  file: File,
): Promise<{ imageUrl: string; imageAspectRatio: number }> {
  const form = new FormData()
  form.append('image', file)
  const res = await fetch(`${BASE}/creatures/${slug}/image`, {
    method: 'POST',
    body: form,
    credentials: 'include',
  })
  if (!res.ok) {
    const body = (await res.json()) as { error?: string }
    throw new Error(body.error || 'Failed to upload image')
  }
  return res.json()
}

export interface SyncProgress {
  total: number
  uploaded: number
  skipped: number
  failed: number
  current: string
  errors: Array<string>
  done: boolean
}

export async function syncR2(
  onProgress: (progress: SyncProgress) => void,
): Promise<void> {
  const res = await fetch(`${BASE}/r2/sync`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to sync R2')
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6)) as SyncProgress
        onProgress(data)
      }
    }
  }
}

export async function listOrphans(): Promise<Array<string>> {
  const res = await fetch(`${BASE}/r2/orphans`, { credentials: 'include' })
  if (!res.ok) throw new Error('Failed to list orphans')
  const data = (await res.json()) as { orphans: Array<string> }
  return data.orphans
}

export async function deleteOrphan(key: string): Promise<void> {
  const res = await fetch(`${BASE}/r2/orphans/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = (await res.json()) as { error?: string }
    throw new Error(body.error || 'Failed to delete orphan')
  }
}

export async function pushImageToR2(slug: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/creatures/${slug}/push-r2`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) {
    const body = (await res.json()) as { error?: string }
    throw new Error(body.error || 'Failed to push to R2')
  }
  return res.json()
}
