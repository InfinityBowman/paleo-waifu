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

// ─── HTML page cache headers ────────────────────────────────────────────

describe('HTML cache headers', () => {
  test('landing page has s-maxage=3600', async () => {
    const res = await head('/')
    const cc = res.headers.get('cache-control')
    expect(cc).toContain('s-maxage=3600')
    expect(cc).toContain('stale-while-revalidate')
  })

  test('encyclopedia has s-maxage=300', async () => {
    const res = await head('/encyclopedia')
    const cc = res.headers.get('cache-control')
    expect(cc).toContain('s-maxage=300')
    expect(cc).toContain('stale-while-revalidate')
  })

  test('leaderboard has s-maxage=60', async () => {
    const res = await head('/leaderboard')
    const cc = res.headers.get('cache-control')
    expect(cc).toContain('s-maxage=60')
    expect(cc).toContain('stale-while-revalidate')
  })

  test('privacy page has s-maxage=3600', async () => {
    const res = await head('/privacy')
    const cc = res.headers.get('cache-control')
    expect(cc).toContain('s-maxage=3600')
    expect(cc).toContain('stale-while-revalidate')
  })

  test('terms page has s-maxage=3600', async () => {
    const res = await head('/terms')
    const cc = res.headers.get('cache-control')
    expect(cc).toContain('s-maxage=3600')
    expect(cc).toContain('stale-while-revalidate')
  })
})

// ─── Security headers ───────────────────────────────────────────────────

describe('security headers on HTML pages', () => {
  const pages = ['/', '/encyclopedia', '/leaderboard', '/privacy', '/terms']

  for (const path of pages) {
    describe(path, () => {
      test('X-Frame-Options is DENY', async () => {
        const res = await head(path)
        expect(res.headers.get('x-frame-options')?.toUpperCase()).toBe('DENY')
      })

      test('X-Content-Type-Options is nosniff', async () => {
        const res = await head(path)
        expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      })

      test('Referrer-Policy is set', async () => {
        const res = await head(path)
        expect(res.headers.get('referrer-policy')).toBeTruthy()
      })

      test('Content-Security-Policy is set', async () => {
        const res = await head(path)
        expect(res.headers.get('content-security-policy')).toBeTruthy()
      })

      test('Permissions-Policy is set', async () => {
        const res = await head(path)
        expect(res.headers.get('permissions-policy')).toBeTruthy()
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

// ─── Content-Type ───────────────────────────────────────────────────────

describe('content-type', () => {
  const pages = ['/', '/encyclopedia', '/leaderboard', '/privacy', '/terms']

  for (const path of pages) {
    test(`${path} returns text/html`, async () => {
      const res = await head(path)
      expect(res.headers.get('content-type')).toContain('text/html')
    })
  }
})
