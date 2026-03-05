import { getRequest } from '@tanstack/react-start/server'
import { createAuth } from './auth'
import { getCfEnv } from './env'
import { getUserRole } from './auth-server'

/** Require an authenticated admin session or throw 'Forbidden'. */
export async function requireAdminSession() {
  const cfEnv = getCfEnv()
  const auth = await createAuth(cfEnv)
  const session = await auth.api.getSession({
    headers: getRequest().headers,
  })
  if (!session || getUserRole(session.user) !== 'admin') {
    throw new Error('Forbidden')
  }
  return { session, cfEnv }
}
