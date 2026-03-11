export type { Creature, Rarity, Stats } from '../../shared/types'
export { toSlug } from '@paleo-waifu/shared/slug'

const CDN_BASE = 'https://cdn.paleowaifu.com'

/** Rewrite `/api/images/…` paths to direct CDN URLs. */
export function toCdnUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('/api/images/')) {
    return `${CDN_BASE}/${imageUrl.slice('/api/images/'.length)}`
  }
  return imageUrl
}
