import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

export const Route = createFileRoute('/api/images/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const key = url.pathname.replace('/api/images/', '')
        if (!key) {
          return new Response('Not found', { status: 404 })
        }

        const cfEnv = env as unknown as Env
        const object = await cfEnv.IMAGES.get(key)
        if (!object) {
          return new Response('Not found', { status: 404 })
        }

        return new Response(object.body, {
          headers: {
            'Content-Type':
              object.httpMetadata?.contentType ?? 'image/webp',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      },
    },
  },
})
