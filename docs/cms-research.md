# CMS / Creature Editor Research

Research into hosting options and CMS alternatives for the creature pipeline dashboard, with the goal of letting non-technical paleo-focused friends make edits and tweaks.

## What You Have Today

The existing creature editor (`tools/pipeline-dashboard/`) is a **React 19 + Hono** app that:

- Full CRUD on 615+ creatures with form-driven UI (all fields: name, scientificName, era, diet, rarity, description, funFacts, etc.)
- Drag-and-drop image upload with automatic WebP conversion and R2 sync
- Filtering by era, rarity, diet + sortable columns + search
- One-click database seeding to local or production D1
- Bulk R2 image sync with progress bars
- Dark theme with warm amber palette matching the main app

**Current limitations:**

- **No auth** — runs on localhost only (`pnpm editor` on port 4200)
- **JSON file as source of truth** — writes to `python/data/creatures_enriched.json`, not directly to D1
- **Not deployed anywhere** — developer-only tool
- **No versioning or undo** — edits are immediate and permanent

The UI is already quite user-friendly (dropdowns, drag-drop, color-coded rarity badges, confirmation dialogs). The main blocker for non-technical users is deployment + auth, not the editor itself.

---

## Hosting Options

### Option A: Cloudflare Workers

Your stack already runs on Cloudflare. Hono is designed for Workers, so the existing editor could be deployed as a Worker with D1 bindings.

**Pros:** Zero new infrastructure, same stack, shared D1 database, free tier likely sufficient
**Cons:** Need to refactor from JSON file reads to D1 queries, bundle size constraints

### Option B: Homelab (Docker)

Your homelab is an HP Spectre x360 (16GB RAM, Ubuntu 24.04) running a custom Rust mini-PaaS with Traefik reverse proxy and Cloudflare Tunnel. Already hosts n8n, Plausible, Dozzle, and the paleo-gateway.

**To add a new service:** Drop a `docker-compose.yml` in `services/<name>/`, add Traefik labels, push to main. Auto-deployed via `deploy.sh`. Accessible at `<name>.jacobmaynard.dev` via the Cloudflare Tunnel + wildcard DNS.

**Available resources:** ~10-12 GB RAM free after existing services.

**Pros:** Full control, easy Docker deploys, already has Traefik + Cloudflare Tunnel + security headers + rate limiting
**Cons:** Single point of failure (one laptop), need to handle D1 sync if not writing directly

---

## CMS Options Evaluated

### 1. Strapi

Open-source Node.js headless CMS with visual content-type builder.

| Aspect | Rating |
|--------|--------|
| Non-technical UX | Excellent — polished admin panel, visual schema builder |
| Self-hosting | Easy Docker setup, works on homelab |
| Cloudflare Workers | **No** — traditional Node.js server |
| D1 integration | **Weak** — own database (Postgres/SQLite), needs sync pipeline |
| Cost | Free (MIT) |

**Verdict:** Great admin UI but adds a second database + sync pipeline. Can't run on Workers. Overkill for structured game data.

### 2. Payload CMS

TypeScript-first headless CMS with official Cloudflare D1 support (announced late 2025).

| Aspect | Rating |
|--------|--------|
| Non-technical UX | Good — clean admin panel, rich text, media library |
| Self-hosting | Moderate — Next.js app, or Cloudflare Workers |
| Cloudflare Workers | **Yes** — official template with D1 adapter |
| D1 integration | Separate D1 database (Payload manages its own schema via Drizzle internally) |
| Cost | Free (MIT), but requires paid Workers plan (>3MB bundle) |

**Verdict:** The only real CMS that runs on Cloudflare Workers with D1. TypeScript-native fits the codebase. But still requires a separate D1 database + webhook sync to your game D1. Adds significant complexity for what amounts to editing ~15 fields on a creature record.

### 3. Directus

Wraps existing SQL databases with an instant admin UI + REST/GraphQL API.

| Aspect | Rating |
|--------|--------|
| Non-technical UX | Good — clean UI but exposes SQL concepts |
| Self-hosting | Easy Docker setup, works on homelab |
| Cloudflare Workers | **No** — Node.js server |
| D1 integration | **Cannot connect to D1** — D1 is only accessible via Workers bindings |
| Cost | Free under $5M revenue (BSL license) |

**Verdict:** The "wrap your existing DB" pitch is compelling, but it can't connect to Cloudflare D1 remotely. Would need a local SQLite + sync pipeline. The BSL license is also a minor concern.

### 4. Sanity

Hosted real-time content platform with customizable React editor (Sanity Studio).

| Aspect | Rating |
|--------|--------|
| Non-technical UX | Excellent — best editing experience, real-time collab |
| Self-hosting | **Not possible** — data lives on Sanity's cloud |
| Cloudflare Workers | Partial — Studio on Pages, data on Sanity cloud |
| D1 integration | Webhook sync only |
| Cost | Free (3 users, 500K API calls/mo), then $15+/user/mo |

**Verdict:** Best-in-class editor UX but vendor lock-in. Your creature data would live on someone else's servers. Overkill for this use case.

### 5. TinaCMS

Git-backed CMS for Markdown/JSON content.

| Aspect | Rating |
|--------|--------|
| Non-technical UX | Moderate — designed for blog posts, not game data |
| Cloudflare Workers | **No** |
| D1 integration | Very weak — content lives in Git files |

**Verdict:** Wrong tool. Designed for content websites, not structured game data management.

### 6. Custom: Enhance the Existing Editor

Evolve `tools/pipeline-dashboard/` into a deployed, authenticated creature editor.

| Aspect | Rating |
|--------|--------|
| Non-technical UX | Needs work — but 80% is already built |
| Self-hosting | Easy — Hono → Workers or Docker |
| Cloudflare Workers | **Yes** — Hono is Workers-native |
| D1 integration | **Direct** — import the same Drizzle schema, zero sync |
| Cost | Free — you already own it |

**What needs to change:**
1. **Auth:** Add Discord OAuth (reuse existing better-auth config) or simple invite-only auth
2. **D1 direct writes:** Replace JSON file read/write with Drizzle queries against D1
3. **Deploy:** As a Cloudflare Worker (separate worker, same D1 binding) or Docker on homelab
4. **UX polish:** Better mobile support, inline validation, maybe an undo/history feature

**What you'd miss vs. a real CMS:** Content versioning, role-based access, audit trail, scheduled publishing. None of these are critical for editing creature descriptions and fun facts.

---

## Comparison Matrix

| Criteria | Strapi | Payload | Directus | Sanity | TinaCMS | Custom |
|----------|--------|---------|----------|--------|---------|--------|
| Non-technical UX | ★★★★★ | ★★★★ | ★★★★ | ★★★★★ | ★★★ | ★★★ (needs work) |
| Cloudflare Workers | ✗ | ✓ | ✗ | Partial | ✗ | ✓ |
| Homelab Docker | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ |
| D1 integration | Sync | Separate D1 | Sync | Webhook | Sync | **Direct** |
| Setup effort | 1-2 weeks | 1-2 weeks | 3-5 days | 3-5 days | N/A | 1-2 weeks |
| Ongoing maintenance | Medium | Medium | Low | Low | N/A | You own it |
| Creature data fit | Good | Excellent | Good | Excellent | Poor | **Perfect** |

---

## Recommendation

### Path A: Enhance the existing editor (recommended)

Deploy your current editor with auth and D1 direct writes. This is the simplest path because:

- **Zero sync overhead** — same Drizzle schema, same D1 database, no data duplication
- **Already 80% built** — creature form, image upload, R2 sync all work
- **Your stack** — Hono on Workers or Docker on homelab, no new tech to learn
- **Purpose-built** — the editor was designed for exactly this data model

**Deployment recommendation:** Cloudflare Workers is cleanest (shared D1 binding, no homelab dependency), but Docker on homelab works too if you want it behind your existing Traefik + Cloudflare Tunnel setup at something like `editor.jacobmaynard.dev`.

**Rough work items:**
1. Add Discord OAuth or invite-link auth (protect the editor)
2. Swap JSON file backend for Drizzle/D1 queries
3. Deploy as a separate Cloudflare Worker or homelab Docker service
4. Polish UX for non-technical users (better validation, help text, mobile)

### Path B: Payload CMS on Cloudflare (if you want a "real" CMS)

Use this path if you expect many editors, need content versioning, or want a battle-tested admin panel. The official Cloudflare D1 template gets you started quickly. Trade-off: two D1 databases + a webhook sync mechanism.

### What I would NOT recommend

- **Strapi / Directus** — Can't run on Workers, requires separate infrastructure + sync pipeline
- **Sanity** — Vendor lock-in, hosted-only data layer
- **TinaCMS** — Wrong tool for structured game data
