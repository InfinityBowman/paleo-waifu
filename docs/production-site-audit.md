# PaleoWaifu Production Site Audit

**Site:** https://paleo-waifu.jacobmaynard.dev
**Date:** 2026-03-02
**Stack:** TanStack Start (SSR) + Cloudflare Workers + D1

---

## Methodology

1. **HTTP Header Inspection** — Fetched response headers for all public pages (`/`, `/encyclopedia`, `/leaderboard`), auth-guarded pages (`/gacha`), static assets (JS, CSS, SVG), CDN images, and API endpoints using `curl -sI`.
2. **Raw HTML Analysis** — Downloaded full HTML payloads to verify server-rendered content, meta tags, document structure, heading hierarchy, ARIA attributes, and hydration patterns.
3. **Performance Measurement** — Measured TTFB, transfer sizes (compressed), and total download times from the Kansas City Cloudflare edge.
4. **Codebase Cross-Reference** — Reviewed route definitions, caching config, security header implementation, asset pipeline, and SSR configuration against actual production behavior.
5. **Web Standards Check** — Assessed against SEO best practices, WCAG accessibility guidelines, Lighthouse categories, and Cloudflare Workers deployment patterns.

---

## Executive Summary

The site has **strong SSR fundamentals** — all public pages are fully server-rendered with real content in the initial HTML payload. TTFB is excellent (68ms landing, 140-157ms data pages). However, there are several significant issues: **static assets are not being cached** (0s max-age on hashed JS/CSS), **security headers are defined in code but never applied to HTML responses**, **no Open Graph or favicon meta tags exist**, and the **image redirect API endpoint is broken** in production.

### Severity Breakdown

| Severity | Count |
|----------|-------|
| Critical | 2 |
| High | 4 |
| Medium | 5 |
| Low | 4 |

---

## Findings

### CRITICAL — Static Asset Caching Completely Broken

**Observed:** All Vite-hashed static assets return `Cache-Control: public, max-age=0, must-revalidate`:

```
# JS bundle
GET /assets/main-BdASDwPY.js
Cache-Control: public, max-age=0, must-revalidate
cf-cache-status: MISS

# CSS bundle
GET /assets/styles-BcybW29G.css
Cache-Control: public, max-age=0, must-revalidate
cf-cache-status: MISS

# Favicon
GET /favicon.svg
Cache-Control: public, max-age=0, must-revalidate
```

**Impact:** Every page load re-downloads all JS/CSS bundles from the Worker. This wastes bandwidth, increases load times for repeat visitors, and drives up Worker invocations (cost). These files have content hashes in their filenames (`-BdASDwPY`) and should be immutably cached.

**Expected:** `Cache-Control: public, max-age=31536000, immutable` for hashed assets, `Cache-Control: public, max-age=3600` for unhashed public files like `favicon.svg`.

**Root Cause:** TanStack Start's Cloudflare Workers adapter likely isn't setting long-lived cache headers for static assets. This needs configuration in the Vite/Cloudflare integration or a Worker middleware that matches `/assets/*` paths and overrides cache headers.

---

### CRITICAL — Security Headers Not Applied to HTML Responses

**Observed:** The production HTML responses contain **zero** security headers:

```
# Response headers for GET /
content-type: text/html; charset=utf-8
cache-control: public, s-maxage=3600, stale-while-revalidate=86400
server: cloudflare
# (no X-Frame-Options, no CSP, no X-Content-Type-Options, etc.)
```

**Code Reference:** `src/lib/utils.ts` defines `SECURITY_HEADERS` with CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy. The `withSecurityHeaders()` utility and `jsonResponse()` helper apply these — but **only to API JSON responses** (`src/routes/api/auth/$.ts`).

**Impact:** The site is vulnerable to:
- **Clickjacking** — no `X-Frame-Options: DENY` on HTML pages
- **MIME sniffing attacks** — no `X-Content-Type-Options: nosniff`
- **No CSP on HTML pages** — XSS has no second line of defense
- **No HSTS** — `Strict-Transport-Security` is missing entirely (even from API responses)

**Fix:** Apply security headers globally — either via a TanStack Start middleware, a `headers()` export on the root route, or a Cloudflare Workers middleware/transform rule.

---

### HIGH — No Open Graph / Social Meta Tags

**Observed:** No `og:title`, `og:description`, `og:image`, `og:url`, `twitter:card`, or `twitter:image` meta tags on any page.

**Impact:** When shared on Discord, Twitter, Facebook, etc., the site will show as a plain URL with no preview card — a major miss for a social/gacha game that relies on community sharing.

**Fix:** Add to the root `head()` function:
```tsx
{ property: 'og:title', content: 'PaleoWaifu — Prehistoric Gacha' },
{ property: 'og:description', content: 'Collect 300+ prehistoric companions...' },
{ property: 'og:image', content: 'https://paleo-waifu.jacobmaynard.dev/og-image.png' },
{ property: 'og:type', content: 'website' },
{ name: 'twitter:card', content: 'summary_large_image' },
```

Consider per-route overrides for encyclopedia creature pages if they get individual URLs.

---

### HIGH — No Favicon Link Tag

**Observed:** A `favicon.svg` exists in `public/` but no `<link rel="icon">` tag is in the HTML `<head>`. Browsers will still find it via convention, but:

- No Apple Touch icon for iOS home screen bookmarks
- No explicit favicon declaration for standards compliance
- No manifest for PWA capability

**Fix:** Add to root `head()` links:
```tsx
{ rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
```

---

### HIGH — CDN Images Not Cached by Cloudflare

**Observed:**
```
GET https://cdn.jacobmaynard.dev/creatures/aardonyx-celestae.webp
cf-cache-status: DYNAMIC
# No Cache-Control header set
```

Images from the R2-backed CDN return `cf-cache-status: DYNAMIC`, meaning Cloudflare is not caching them at the edge. Every request goes to R2 origin.

**Impact:** Slower image loads globally, higher R2 read costs, no edge caching benefit.

**Fix:** Configure R2 custom domain or add a Cache Rule in Cloudflare dashboard to set `Cache-Control: public, max-age=31536000, immutable` for `cdn.jacobmaynard.dev/creatures/*`. Alternatively, configure the R2 bucket's `Cache-Control` response header.

---

### HIGH — Image Redirect API Endpoint Broken

**Observed:**
```
GET /api/images/creatures/aardonyx-celestae.webp
HTTP/2 200  (text/html — NOT a 301 redirect)
```

The `src/routes/api/images/$.ts` route defines a `GET` handler that should return a `301` redirect to the CDN. Instead, it returns a `200` with `text/html`, suggesting the route handler isn't being hit and TanStack Start is falling through to the SPA shell.

**Impact:** Any old image URLs using `/api/images/` won't redirect — they'll return the app HTML shell. The `toCdnUrl()` client-side rewrite masks this for current users, but any external links, cached HTML, or bot crawlers hitting these URLs get broken responses.

**Fix:** Investigate why the TanStack Start server handler for this catch-all route isn't matching. May need a different route pattern or a Cloudflare Workers route rule.

---

### MEDIUM — All Pages Share Identical Meta Tags

**Observed:** Every page returns the same `<title>` and `<meta description>`:

```
/            → "PaleoWaifu — Prehistoric Gacha"
/encyclopedia → "PaleoWaifu — Prehistoric Gacha"
/leaderboard  → "PaleoWaifu — Prehistoric Gacha"
```

**Impact:** Poor SEO differentiation between pages. Search engines see duplicate titles/descriptions across the entire site.

**Fix:** Add per-route `head()` overrides:
- `/encyclopedia` → "Encyclopedia — PaleoWaifu" / "Browse 300+ prehistoric creatures..."
- `/leaderboard` → "Leaderboard — PaleoWaifu" / "Top collectors and XP rankings"

---

### MEDIUM — No `Vary` Header on HTML Responses

**Observed:** HTML responses don't include a `Vary` header. Since Cloudflare compresses with Brotli (`content-encoding: br`), a `Vary: Accept-Encoding` header should be present to ensure CDN edge caches don't serve Brotli-encoded responses to clients that don't support it.

Cloudflare usually handles this automatically at the proxy layer, but it's best practice to set it explicitly for correctness, especially when using `s-maxage` for edge caching.

---

### MEDIUM — No `robots.txt` or `sitemap.xml`

**Observed:**
```
GET /robots.txt  → Returns Cloudflare content signals (not a standard robots.txt)
GET /sitemap.xml → 404
```

The `robots.txt` is being served by Cloudflare's content signals feature, not by the application. No sitemap exists.

**Impact:** Search engines have no guidance on crawling priorities. The encyclopedia (with potentially 300+ creature pages) would benefit significantly from a sitemap.

**Fix:** Add a `public/robots.txt` with standard directives and a sitemap reference. Consider generating a dynamic sitemap via an API route that queries the creature database.

---

### MEDIUM — Encyclopedia Images All Lazy-Loaded (No Eager Above-Fold)

**Observed:** All 30 creature card images on `/encyclopedia` use `loading="lazy"`. The `CreatureCard` component supports an `eager` prop, but it's not being used for above-the-fold cards.

**Impact:** The first ~8-12 visible cards on page load will show blank placeholders until the browser's lazy-load observer fires (typically after layout). This creates a visual flash on initial paint.

**Fix:** Pass `eager={true}` to the first row of cards (first 4-6 depending on viewport).

---

### MEDIUM — Google Fonts Render-Blocking

**Observed:** Three Google Font families loaded via `<link rel="stylesheet">` in `<head>`:
- Shippori Mincho (5 weights)
- M PLUS Rounded 1c (5 weights)
- Klee One (2 weights)

This is **12 font weight variants** loaded as a render-blocking stylesheet. The `display=swap` flag helps (text renders immediately with fallback), but the stylesheet request itself blocks first paint.

**Impact:** First Contentful Paint is delayed by the font stylesheet fetch latency (~100-300ms depending on connection). The `preconnect` hints help but don't eliminate the blocking nature.

**Fix Options:**
1. Reduce font weights — do you actually use all 5 weights of each?
2. Self-host fonts as static assets (eliminates the extra DNS + connection to fonts.googleapis.com)
3. Use `<link rel="preload" as="style">` + async load pattern for non-critical fonts

---

### LOW — No `Strict-Transport-Security` (HSTS) Header

**Observed:** No HSTS header on any response. While Cloudflare forces HTTPS at the proxy level, an HSTS header tells browsers to always use HTTPS directly, avoiding redirect latency and protecting against protocol downgrade attacks.

**Fix:** Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` to response headers (can be done via Cloudflare dashboard or Worker headers).

---

### LOW — Heading Hierarchy Correct but Worth Noting

**Observed (landing page):** `h1` → `h2` (x3) → `h3` (x6). Correct hierarchy. Each page has one `h1`.

**Observed (encyclopedia):** `h1` ("Encyclopedia") present. Card names not wrapped in headings (reasonable for a grid of cards).

No issues here — just confirming proper structure.

---

### LOW — SSR Hydration Data Payload

**Observed:** The HTML for `/encyclopedia` embeds the full first page of creature data (30 creatures with all fields) as inline JSON in the `<script class="$tsr">` hydration block. This is standard TanStack Router behavior and necessary for hydration correctness.

**Stats:**
| Page | Uncompressed HTML | Compressed (Brotli) |
|------|-------------------|---------------------|
| `/` | 42.6 KB | 13.6 KB |
| `/encyclopedia` | ~45 KB | 11.0 KB |
| `/leaderboard` | ~30 KB | 7.4 KB |

These are reasonable payload sizes. Brotli compression is effective (68-75% reduction).

---

### LOW — Dark Mode Script Runs Before `<head>` Completes

**Observed:** An inline `<script>document.documentElement.classList.add('dark')</script>` runs in `<head>` to prevent FOUC. However, the `<html>` tag already has `class="dark"` set server-side:

```html
<html lang="en" class="dark">
```

**Impact:** The inline script is redundant — the class is already present in the SSR output. It only matters if the server ever renders without the class (which it doesn't, since dark mode is unconditional).

**Fix:** Can safely remove the inline script to slightly reduce HTML payload and eliminate a synchronous script execution during parsing.

---

## Performance Summary

| Metric | Landing (`/`) | Encyclopedia | Leaderboard |
|--------|---------------|--------------|-------------|
| TTFB | 68ms | 157ms | 140ms |
| Transfer Size | 13.6 KB | 11.0 KB | 7.4 KB |
| Total Time | 70ms | 157ms | 140ms |
| Cache-Control | s-maxage=3600 | s-maxage=300 | s-maxage=60 |

TTFB is excellent. The data-heavy pages (encyclopedia, leaderboard) add ~80-90ms for D1 database queries, which is very good for a Cloudflare Workers + D1 setup.

---

## What's Working Well

1. **Full SSR** — All content is server-rendered in the initial HTML. The landing page has complete hero, feature sections, and CTAs. Encyclopedia has 30 creature cards with names, images, and metadata. No empty shell/spinner patterns.
2. **Route-Level Cache-Control** — Sensible tiered caching: 1h for landing, 5min for encyclopedia, 60s for leaderboard. Uses `stale-while-revalidate` for smooth edge cache refreshes.
3. **Brotli Compression** — Active on all HTML responses (68-75% compression ratio).
4. **Module Preloading** — 13 `<link rel="modulepreload">` tags for route-split JS chunks, enabling parallel downloads.
5. **Image Format** — WebP used for all creature images.
6. **Image Lazy Loading** — All off-screen images use `loading="lazy"`.
7. **Aspect Ratio Preservation** — `imageAspectRatio` from DB prevents CLS on image load.
8. **Auth Guard Correctness** — `/gacha` correctly returns `307 → /` redirect for unauthenticated users (server-side, no client flash).
9. **Dark Mode** — No FOUC; class applied in SSR output.
10. **Alt Text** — Encyclopedia creature images have proper alt text (creature name).
11. **Accessible Navigation** — `aria-current="page"` on active nav link, `sr-only` labels on icon buttons.
12. **Proper HTML Document** — `<!DOCTYPE html>`, `<html lang="en">`, `charset`, `viewport` all present.
13. **Analytics** — Plausible loaded async (non-blocking).
14. **Scroll Restoration** — TanStack Router configured with `scrollRestoration: true`.

---

## Priority Action Items

| Priority | Issue | Effort |
|----------|-------|--------|
| 1 | Fix static asset caching (JS/CSS/SVG) | Medium — needs Cloudflare rule or Worker middleware |
| 2 | Apply security headers to HTML responses | Low — add to root route `headers()` or middleware |
| 3 | Add Open Graph + Twitter Card meta tags | Low — add to root `head()` |
| 4 | Fix CDN image caching | Low — Cloudflare Cache Rule or R2 config |
| 5 | Fix `/api/images/` redirect endpoint | Medium — route handler investigation |
| 6 | Add per-route titles and descriptions | Low — add `head()` to each route |
| 7 | Add favicon link tag | Trivial |
| 8 | Add HSTS header | Trivial — Cloudflare dashboard toggle |
| 9 | Reduce Google Fonts payload | Low — audit used weights, consider self-hosting |
| 10 | Add `robots.txt` and `sitemap.xml` | Low-Medium |
| 11 | Eager-load above-fold encyclopedia images | Trivial |
| 12 | Remove redundant dark mode script | Trivial |
