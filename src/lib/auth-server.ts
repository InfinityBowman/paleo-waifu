import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createAuth } from './auth'
import { getCfEnv } from './env'

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
