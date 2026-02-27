import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { createAuth } from './auth'

export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const auth = createAuth(env as unknown as Env)
    const session = await auth.api.getSession({
      headers: request.headers,
    })
    return session
  },
)

export const ensureSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/' })
    }
    return session
  },
)
