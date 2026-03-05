import { createFileRoute } from '@tanstack/react-router'

const SITE_URL = 'https://paleo-waifu.jacobmaynard.dev'

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/encyclopedia', priority: '0.8', changefreq: 'weekly' },
  { path: '/leaderboard', priority: '0.7', changefreq: 'hourly' },
]

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: () => {
        const urls = STATIC_PAGES.map(
          (p) => `
  <url>
    <loc>${SITE_URL}${p.path}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`,
        ).join('')

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}
</urlset>`

        return new Response(xml, {
          headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        })
      },
    },
  },
})
