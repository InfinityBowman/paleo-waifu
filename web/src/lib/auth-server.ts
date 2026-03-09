import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createAuth } from './auth'
import { getCfEnv } from './env'

/** Extract user role from session (works around better-auth's missing role type) */
export function getUserRole(user: Record<string, unknown>): string | undefined {
  return (user as { role?: string }).role
}

export const getSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const request = getRequest()
    const auth = await createAuth(getCfEnv())
    const session = await auth.api.getSession({
      headers: request.headers,
    })
    return session
  },
)
