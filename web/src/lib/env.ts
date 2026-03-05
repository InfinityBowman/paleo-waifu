import { env } from 'cloudflare:workers'

export function getCfEnv(): Env {
  return env as unknown as Env
}
