import { createFileRoute } from '@tanstack/react-router'

const CDN_BASE = 'https://cdn.paleowaifu.com'

export const Route = createFileRoute('/api/images/$')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url)
        const key = decodeURIComponent(url.pathname.replace('/api/images/', ''))
        if (
          !key ||
          key.startsWith('/') ||
          key.includes('..') ||
          key.includes('\0') ||
          key.includes('//') ||
          !/^[\w\-./]+$/.test(key)
        ) {
          return new Response('Not found', { status: 404 })
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: `${CDN_BASE}/${key}`,
            'Cache-Control': 'public, max-age=86400',
          },
        })
      },
    },
  },
})
