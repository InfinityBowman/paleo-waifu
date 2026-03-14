import { describe, expect, test } from 'vitest'

const BASE = process.env.TEST_BASE_URL ?? 'https://paleowaifu.com'

async function head(path: string, opts?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'HEAD',
    redirect: 'manual',
    ...opts,
  })
  return res
}

async function get(path: string) {
  const res = await fetch(`${BASE}${path}`, { redirect: 'manual' })
  return res
}

// ─── Per-page header checks (one fetch per page) ────────────────────────

const pages = [
  { path: '/', smaxage: 3600 },
  { path: '/encyclopedia', smaxage: 300 },
  { path: '/leaderboard', smaxage: 60 },
  { path: '/privacy', smaxage: 3600 },
  { path: '/terms', smaxage: 3600 },
]

describe('HTML page headers', () => {
  for (const { path, smaxage } of pages) {
    describe(path, () => {
      test('content-type, cache, and security headers', async () => {
        const res = await head(path)
        const h = res.headers

        // Content-Type
        expect(h.get('content-type')).toContain('text/html')

        // Cache
        const cc = h.get('cache-control')
        expect(cc).toContain(`s-maxage=${smaxage}`)
        expect(cc).toContain('stale-while-revalidate')

        // Security
        expect(h.get('x-frame-options')?.toUpperCase()).toBe('DENY')
        expect(h.get('x-content-type-options')).toBe('nosniff')
        expect(h.get('referrer-policy')).toBeTruthy()
        expect(h.get('content-security-policy')).toBeTruthy()
        expect(h.get('permissions-policy')).toBeTruthy()
      })
    })
  }
})

// ─── Static asset caching ───────────────────────────────────────────────

describe('static asset caching', () => {
  test('hashed JS assets have long-lived immutable cache', async () => {
    // Fetch landing page to discover a real asset URL
    const html = await get('/').then((r) => r.text())
    const jsMatch = html.match(/\/assets\/main-[A-Za-z0-9]+\.js/)
    expect(jsMatch).toBeTruthy()

    const res = await head(jsMatch![0])
    const cc = res.headers.get('cache-control')
    expect(cc).toContain('max-age=')
    // Should be long-lived (at least 1 day = 86400s), not max-age=0
    const maxAge = cc?.match(/max-age=(\d+)/)
    expect(Number(maxAge?.[1])).toBeGreaterThan(86400)
  })

  test('hashed CSS assets have long-lived immutable cache', async () => {
    const html = await get('/').then((r) => r.text())
    const cssMatch = html.match(/\/assets\/styles-[A-Za-z0-9_]+\.css/)
    expect(cssMatch).toBeTruthy()

    const res = await head(cssMatch![0])
    const cc = res.headers.get('cache-control')
    expect(cc).toContain('max-age=')
    const maxAge = cc?.match(/max-age=(\d+)/)
    expect(Number(maxAge?.[1])).toBeGreaterThan(86400)
  })
})

// ─── Compression ────────────────────────────────────────────────────────

describe('compression', () => {
  test('HTML responses are compressed', async () => {
    const res = await fetch(`${BASE}/`, {
      headers: { 'Accept-Encoding': 'br, gzip' },
    })
    const encoding = res.headers.get('content-encoding')
    expect(encoding).toMatch(/br|gzip/)
  })
})
