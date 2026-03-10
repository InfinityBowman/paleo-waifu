import { createFileRoute } from '@tanstack/react-router'
import { isNotNull } from 'drizzle-orm'
import { createDb } from '@paleo-waifu/shared/db/client'
import { creature } from '@paleo-waifu/shared/db/schema'
import { getCfEnv } from '@/lib/env'

const SITE_URL = 'https://paleowaifu.com'

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/encyclopedia', priority: '0.8', changefreq: 'weekly' },
  { path: '/leaderboard', priority: '0.7', changefreq: 'hourly' },
  { path: '/patch-notes', priority: '0.5', changefreq: 'weekly' },
]

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const db = await createDb(getCfEnv().DB)
        const slugs = await db
          .select({ slug: creature.slug })
          .from(creature)
          .where(isNotNull(creature.slug))
          .all()

        const staticUrls = STATIC_PAGES.map(
          (p) => `
  <url>
    <loc>${SITE_URL}${p.path}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
        ).join('')

        const creatureUrls = slugs
          .map(
            (r) => `
  <url>
    <loc>${SITE_URL}/encyclopedia/${r.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`,
          )
          .join('')

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticUrls}${creatureUrls}
</urlset>`

        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml',
            'Cache-Control':
              'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        })
      },
    },
  },
})
