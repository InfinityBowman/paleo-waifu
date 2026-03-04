export type { Creature, Rarity, Stats } from '../../shared/types'
export { slugify } from '../../shared/types'

const CDN_BASE = 'https://cdn.jacobmaynard.dev'

/** Rewrite `/api/images/…` paths to direct CDN URLs. */
export function toCdnUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('/api/images/')) {
    return `${CDN_BASE}/${imageUrl.slice('/api/images/'.length)}`
  }
  return imageUrl
}
