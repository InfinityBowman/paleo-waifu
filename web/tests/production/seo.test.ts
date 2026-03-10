import { describe, expect, test } from 'vitest'

const BASE = process.env.TEST_BASE_URL ?? 'https://paleowaifu.com'

// Cache HTML fetches so we don't slam the server
const htmlCache = new Map<string, string>()

async function getHtml(path: string): Promise<string> {
  if (htmlCache.has(path)) return htmlCache.get(path)!
  const res = await fetch(`${BASE}${path}`)
  const html = await res.text()
  htmlCache.set(path, html)
  return html
}

// ─── Document structure ─────────────────────────────────────────────────

describe('document structure', () => {
  const pages = ['/', '/encyclopedia', '/leaderboard']

  for (const path of pages) {
    describe(path, () => {
      test('has <!DOCTYPE html>', async () => {
        const html = await getHtml(path)
        expect(html).toMatch(/^<!DOCTYPE html>/i)
      })

      test('has <html lang="en">', async () => {
        const html = await getHtml(path)
        expect(html).toMatch(/<html[^>]+lang="en"/)
      })

      test('has charset meta tag', async () => {
        const html = await getHtml(path)
        expect(html).toMatch(/charset="?utf-8"?/i)
      })

      test('has viewport meta tag', async () => {
        const html = await getHtml(path)
        expect(html).toContain('width=device-width')
      })
    })
  }
})

// ─── Unique titles per page ─────────────────────────────────────────────

describe('unique page titles', () => {
  test('each public page has a distinct <title>', async () => {
    const pages = ['/', '/encyclopedia', '/leaderboard']
    const titles = new Map<string, string>()

    for (const path of pages) {
      const html = await getHtml(path)
      const match = html.match(/<title>([^<]+)<\/title>/)
      expect(match, `${path} should have a <title> tag`).toBeTruthy()
      titles.set(path, match![1])
    }

    const uniqueTitles = new Set(titles.values())
    expect(
      uniqueTitles.size,
      `Expected ${pages.length} unique titles but got ${uniqueTitles.size}: ${JSON.stringify(Object.fromEntries(titles))}`,
    ).toBe(pages.length)
  })
})

// ─── Meta description ───────────────────────────────────────────────────

describe('meta descriptions', () => {
  const pages = ['/', '/encyclopedia', '/leaderboard']

  for (const path of pages) {
    test(`${path} has a meta description`, async () => {
      const html = await getHtml(path)
      const match = html.match(
        /<meta[^>]+name="description"[^>]+content="([^"]+)"/,
      )
      expect(match, `${path} should have a meta description`).toBeTruthy()
      expect(match![1].length).toBeGreaterThan(20)
    })
  }

  test('meta descriptions are unique per page', async () => {
    const descriptions = new Map<string, string>()
    for (const path of pages) {
      const html = await getHtml(path)
      const match = html.match(
        /<meta[^>]+name="description"[^>]+content="([^"]+)"/,
      )
      if (match) descriptions.set(path, match[1])
    }

    const unique = new Set(descriptions.values())
    expect(
      unique.size,
      `Expected ${pages.length} unique descriptions but got ${unique.size}`,
    ).toBe(pages.length)
  })
})

// ─── Open Graph tags ────────────────────────────────────────────────────

describe('Open Graph meta tags', () => {
  const pages = ['/', '/encyclopedia', '/leaderboard']
  const requiredOgTags = ['og:title', 'og:description', 'og:image']

  for (const path of pages) {
    for (const tag of requiredOgTags) {
      test(`${path} has ${tag}`, async () => {
        const html = await getHtml(path)
        const regex = new RegExp(
          `<meta[^>]+property="${tag}"[^>]+content="([^"]+)"`,
        )
        const match = html.match(regex)
        expect(match, `${path} should have ${tag}`).toBeTruthy()
        expect(match![1].length).toBeGreaterThan(0)
      })
    }
  }

  test('/ has twitter:card meta tag', async () => {
    const html = await getHtml('/')
    expect(html).toMatch(/<meta[^>]+name="twitter:card"[^>]+/)
  })
})

// ─── Favicon ────────────────────────────────────────────────────────────

describe('favicon', () => {
  test('has a <link rel="icon"> tag', async () => {
    const html = await getHtml('/')
    expect(html).toMatch(/<link[^>]+rel="icon"/)
  })
})

// ─── Heading hierarchy ─────────────────────────────────────────────────

describe('heading hierarchy', () => {
  const pages = ['/', '/encyclopedia', '/leaderboard']

  for (const path of pages) {
    test(`${path} has exactly one <h1>`, async () => {
      const html = await getHtml(path)
      const h1s = html.match(/<h1[\s>]/g)
      expect(h1s, `${path} should have at least one <h1>`).toBeTruthy()
      expect(h1s!.length, `${path} should have exactly one <h1>`).toBe(1)
    })
  }
})

// ─── robots.txt & sitemap ───────────────────────────────────────────────

describe('crawlability', () => {
  test('robots.txt returns 200', async () => {
    const res = await fetch(`${BASE}/robots.txt`)
    expect(res.status).toBe(200)
  })

  test('sitemap.xml returns 200', async () => {
    const res = await fetch(`${BASE}/sitemap.xml`)
    expect(res.status).toBe(200)
  })
})
