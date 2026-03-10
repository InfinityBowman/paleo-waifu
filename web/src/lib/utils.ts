import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ClassValue } from 'clsx'

export function cn(...inputs: Array<ClassValue>) {
  return twMerge(clsx(inputs))
}

const CDN_BASE = 'https://cdn.paleowaifu.com'

/** Rewrite `/api/images/…` paths to direct CDN URLs to avoid Worker round-trips. */
export function toCdnUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('/api/images/')) {
    return `${CDN_BASE}/${imageUrl.slice('/api/images/'.length)}`
  }
  return imageUrl
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-store',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' cdn.paleowaifu.com cdn.discordapp.com media.discordapp.net; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
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

/** Distribute items into columns for masonry layout, balancing by estimated height. */
export function distributeToColumns<
  T extends { imageAspectRatio?: number | null },
>(items: Array<T>, columnCount: number): Array<Array<T>> {
  const cols: Array<Array<T>> = Array.from({ length: columnCount }, () => [])
  const heights = new Array<number>(columnCount).fill(0)
  for (const item of items) {
    let minIdx = 0
    for (let i = 1; i < columnCount; i++) {
      if (heights[i] < heights[minIdx]) minIdx = i
    }
    cols[minIdx].push(item)
    const imgH = item.imageAspectRatio ? 1 / item.imageAspectRatio : 1
    heights[minIdx] += imgH + 0.3
  }
  return cols
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
