import type { Creature, Stats } from './types'

const BASE = '/api'

export async function fetchCreatures(): Promise<{
  creatures: Creature[]
  stats: Stats
}> {
  const res = await fetch(`${BASE}/creatures`)
  if (!res.ok) throw new Error('Failed to fetch creatures')
  return res.json()
}

export async function fetchCreature(
  slug: string,
): Promise<{ creature: Creature }> {
  const res = await fetch(`${BASE}/creatures/${slug}`)
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
  const res = await fetch(url, { method: 'DELETE' })
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
  })
  if (!res.ok) {
    const body = (await res.json()) as { error?: string }
    throw new Error(body.error || 'Failed to upload image')
  }
  return res.json()
}

export async function seedDb(
  target: 'local' | 'prod',
): Promise<{ ok: boolean; creatureCount: number; output: string }> {
  const res = await fetch(`${BASE}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  })
  if (!res.ok) throw new Error('Failed to seed database')
  return res.json()
}
