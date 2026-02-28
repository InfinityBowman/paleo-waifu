import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ClassValue } from 'clsx'

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs))
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' cdn.jacobmaynard.dev cdn.discordapp.com media.discordapp.net; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
}

export function jsonResponse(body: unknown, status = 200): Response {
  return withSecurityHeaders(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

export function withSecurityHeaders(response: Response): Response {
  const newResponse = new Response(response.body, response)
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    newResponse.headers.set(key, value)
  }
  return newResponse
}

/** Returns an error Response if Origin header doesn't match, or null if OK.
 *  Non-browser clients don't send Origin — the session cookie's SameSite=Lax
 *  defends cross-site form POSTs; this adds a second layer for fetch-based CSRF. */
export function checkCsrfOrigin(request: Request): Response | null {
  const origin = request.headers.get('Origin')
  if (!origin) return null
  let parsedOrigin: URL
  try {
    parsedOrigin = new URL(origin)
  } catch {
    return jsonResponse({ error: 'Origin mismatch' }, 403)
  }
  const requestUrl = new URL(request.url)
  if (parsedOrigin.origin !== requestUrl.origin) {
    return jsonResponse({ error: 'Origin mismatch' }, 403)
  }
  return null
}
