import { createFileRoute } from '@tanstack/react-router'
import { createAuth } from '@/lib/auth'
import { getCfEnv } from '@/lib/env'
import { withSecurityHeaders } from '@/lib/utils'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = createAuth(getCfEnv())
        return withSecurityHeaders(await auth.handler(request))
      },
      POST: async ({ request }) => {
        const auth = createAuth(getCfEnv())
        return withSecurityHeaders(await auth.handler(request))
      },
    },
  },
})
