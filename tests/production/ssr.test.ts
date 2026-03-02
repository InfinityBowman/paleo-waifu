import { describe, test, expect } from 'vitest'

const BASE = process.env.TEST_BASE_URL ?? 'https://paleo-waifu.jacobmaynard.dev'

// ─── Server-rendered content ────────────────────────────────────────────

describe('SSR content', () => {
  test('landing page has rendered hero content', async () => {
    const html = await fetch(`${BASE}/`).then((r) => r.text())
    // These strings should be present in the initial HTML, not loaded client-side
    expect(html).toContain('PaleoWaifu')
    expect(html).toContain('Summon Now')
    expect(html).toContain('Browse Encyclopedia')
  })

  test('encyclopedia has server-rendered creature cards', async () => {
    const html = await fetch(`${BASE}/encyclopedia`).then((r) => r.text())
    expect(html).toContain('Encyclopedia')
    // Should have at least some creature images rendered in the HTML
    const imgCount = (html.match(/<img[^>]+alt="/g) || []).length
    expect(imgCount, 'should have server-rendered creature card images').toBeGreaterThan(5)
  })

  test('leaderboard has server-rendered player data', async () => {
    const html = await fetch(`${BASE}/leaderboard`).then((r) => r.text())
    expect(html).toContain('Leaderboard')
    // Should contain actual player names rendered in the HTML, not just an empty shell
    const hasPlayerData = /Sinn|Infinity|Darkmatter/.test(html) || html.includes('XP')
    expect(hasPlayerData, 'should have server-rendered player data').toBeTruthy()
  })

  test('landing page has nav with public links', async () => {
    const html = await fetch(`${BASE}/`).then((r) => r.text())
    expect(html).toContain('href="/encyclopedia"')
    expect(html).toContain('href="/leaderboard"')
  })

  test('landing page does NOT contain auth-only nav links', async () => {
    const html = await fetch(`${BASE}/`).then((r) => r.text())
    // Unauthenticated landing page should not render gacha/collection/trade links
    expect(html).not.toMatch(/href="\/gacha"/)
    expect(html).not.toMatch(/href="\/collection"/)
    expect(html).not.toMatch(/href="\/trade"/)
  })
})

// ─── Auth redirects ─────────────────────────────────────────────────────

describe('auth-guarded routes redirect unauthenticated users', () => {
  const protectedPaths = ['/gacha', '/collection', '/trade', '/profile']

  for (const path of protectedPaths) {
    test(`${path} redirects to /`, async () => {
      const res = await fetch(`${BASE}${path}`, { redirect: 'manual' })
      expect(res.status).toBeGreaterThanOrEqual(300)
      expect(res.status).toBeLessThan(400)
      const location = res.headers.get('location')
      expect(location).toMatch(/\/$/)
    })
  }
})

// ─── Image redirect API ────────────────────────────────────────────────

describe('/api/images redirect', () => {
  test('redirects to CDN with 301', async () => {
    const res = await fetch(`${BASE}/api/images/creatures/aardonyx-celestae.webp`, {
      redirect: 'manual',
    })
    expect(res.status).toBe(301)
    const location = res.headers.get('location')
    expect(location).toContain('cdn.jacobmaynard.dev')
  })

  test('redirect has immutable cache header', async () => {
    const res = await fetch(`${BASE}/api/images/creatures/aardonyx-celestae.webp`, {
      redirect: 'manual',
    })
    const cc = res.headers.get('cache-control')
    expect(cc).toContain('immutable')
    expect(cc).toContain('max-age=31536000')
  })

  test('rejects path traversal attempts', async () => {
    const res = await fetch(`${BASE}/api/images/../../../etc/passwd`, {
      redirect: 'manual',
    })
    expect(res.status).toBe(404)
  })
})

// ─── 404 handling ──────────────────────────────────────────────────────

describe('404 handling', () => {
  test('unknown routes return 404 with HTML content', async () => {
    const res = await fetch(`${BASE}/this-page-does-not-exist-12345`)
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toContain('text/html')
  })
})

// ─── CDN images ────────────────────────────────────────────────────────

describe('CDN image delivery', () => {
  test('creature images are accessible from CDN', async () => {
    const res = await fetch('https://cdn.jacobmaynard.dev/creatures/aardonyx-celestae.webp', {
      method: 'HEAD',
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image/webp')
  })

  test('CDN images have cache headers', async () => {
    const res = await fetch('https://cdn.jacobmaynard.dev/creatures/aardonyx-celestae.webp', {
      method: 'HEAD',
    })
    // Should be cacheable — either via cache-control or cf-cache-status
    const cc = res.headers.get('cache-control')
    const cfCache = res.headers.get('cf-cache-status')
    const isCached = (cc && !cc.includes('no-store')) || cfCache === 'HIT'
    expect(isCached, 'CDN images should be cacheable').toBeTruthy()
  })
})
