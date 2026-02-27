import { createFileRoute } from '@tanstack/react-router'
import { getCfEnv } from '@/lib/env'
import { withSecurityHeaders } from '@/lib/utils'

export const Route = createFileRoute('/api/images/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const key = decodeURIComponent(url.pathname.replace('/api/images/', ''))
        if (
          !key ||
          key.includes('..') ||
          key.includes('\0') ||
          !/^[\w\-./]+$/.test(key)
        ) {
          return new Response('Not found', { status: 404 })
        }

        const cfEnv = getCfEnv()
        const object = await cfEnv.IMAGES.get(key)
        if (!object) {
          return new Response('Not found', { status: 404 })
        }

        return withSecurityHeaders(
          new Response(object.body, {
            headers: {
              'Content-Type': object.httpMetadata?.contentType ?? 'image/webp',
              'Cache-Control': 'public, max-age=31536000, immutable',
            },
          }),
        )
      },
    },
  },
})
