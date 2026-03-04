# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Commands

```bash
pnpm dev              # Dev server on http://localhost:3000
pnpm build            # Production build
pnpm deploy           # Build + deploy to Cloudflare Workers (production env)
pnpm db:generate      # Generate Drizzle migration files
pnpm db:migrate:local # Apply migrations to local D1
pnpm db:migrate:prod  # Apply migrations to production D1
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm check            # Prettier --write + ESLint --fix
pnpm typecheck        # Typecheck -- IMPORTANT TO USE THIS FOR ALL TYPE CHECKS BECAUSE USING tsc DIRECTLY WILL IGNORE PROJECT CONFIG

# Testing
pnpm test             # Run production integration tests (hits live site)
pnpm test:watch       # Run tests in watch mode

# Creature editor
pnpm editor           # Creature editor UI (http://localhost:4200)

# Bot commands
pnpm bot:dev          # Local bot worker dev server
pnpm bot:deploy       # Deploy bot to Cloudflare Workers
pnpm bot:register     # Register slash commands (dev guild)
pnpm bot:register:prod # Register slash commands (global)
pnpm bot:typecheck    # Typecheck bot

# Gateway commands
pnpm gateway:dev      # Local gateway dev server
pnpm gateway:build    # Build gateway with esbuild
pnpm gateway:typecheck # Typecheck gateway
```

## Environment

Requires a `.env` file. Copy `.env.example` and fill in values:

- `AUTH_SECRET` — Random string for session signing
- `AUTH_BASE_URL` — App URL (http://localhost:3000 for dev)
- `DISCORD_CLIENT_ID` — Discord OAuth application client ID
- `DISCORD_CLIENT_SECRET` — Discord OAuth application client secret

## Architecture

Prehistoric animal waifu gacha game built with **TanStack Start** (SSR) + **TanStack Router** (file-based routing), React 19, Tailwind CSS v4, deployed to **Cloudflare Workers** with D1 database.

### Monorepo Structure

pnpm workspace with 5 packages:

- **Root** (`/`) — Main TanStack Start web app
- **`packages/shared`** (`@paleo-waifu/shared`) — Runtime-agnostic shared code (DB schema, types, constants)
- **`bot/`** — Discord bot (Cloudflare Worker)
- **`gateway/`** — Discord gateway listener (Node.js, Docker)
- **`editor/`** — Creature editor dashboard (React + Hono)
- Python - data analysis and database tools, use `uv` for python.

### Shared Package (`@paleo-waifu/shared`)

Buildless package — exports `.ts` files directly, consumers' bundlers compile them.

```
@paleo-waifu/shared/types         # Rarity, TradeStatus, RARITY_ORDER, gacha constants
@paleo-waifu/shared/xp            # xpForLevel(), XP constants
@paleo-waifu/shared/db/schema     # All Drizzle table definitions
@paleo-waifu/shared/db/client     # createDb(), Database type
@paleo-waifu/shared/battle/types  # Role, AbilityTemplateData, etc.
@paleo-waifu/shared/battle/constants # RARITY_BASE_TOTALS, ability templates, etc.
```

When adding code used by 2+ workspaces, add it to `packages/shared/`. When adding code used only by the main app, keep it in `src/lib/`.

### Routing

File-based routing via TanStack Router. Route tree auto-generated in `src/routeTree.gen.ts` — do not edit manually. Two layout groups:

- `_public` — Public layout with nav (landing, encyclopedia, leaderboard)
- `_app` — Auth-guarded layout (gacha, collection, trade, profile)

Routes:

- `/` — Landing page
- `/encyclopedia` — Browse all creatures (public)
- `/leaderboard` — Top players by XP and collection (public)
- `/gacha` — Pull screen (auth required)
- `/collection` — My collection (auth required)
- `/trade` — Trade marketplace (auth required)
- `/profile` — Profile & stats (auth required)
- `/admin` — Admin dashboard (auth required, admin only)
- `/sitemap.xml` — XML sitemap for crawlers
- `/api/auth/$` — better-auth catch-all
- `/api/gacha` — POST pull endpoint
- `/api/trade` — POST create/accept/cancel trade
- `/api/collection` — POST collection management
- `/api/admin` — Admin API endpoint
- `/api/images/$` — 302 redirect to CDN for creature images

### Code Organization

- `packages/shared/src/` — Shared types, DB schema, XP config, battle constants
- `src/routes/` — File-based route definitions
- `src/components/gacha/` — Banner select, pull button, animation, card reveal
- `src/components/collection/` — Grid, creature card, detail modal
- `src/components/encyclopedia/` — Browse and filter all creatures
- `src/components/trade/` — Trade list, offer, card
- `src/components/layout/` — Nav with auth state
- `src/components/landing/` — Hero section
- `src/components/admin/` — Admin dashboard components
- `src/components/shared/` — Shared components (CreatureCard, CreaturePickerModal)
- `src/components/ui/` — shadcn/ui primitives
- `src/lib/` — Auth, gacha logic, rarity styles, utilities
- `src/store/` — Zustand store (fossils, pull results)
- `python/` — Data pipeline for creature scraping, enrichment, image generation, and R2 upload
- `editor/` — Creature editor dashboard (React + Hono, run via `pnpm editor`)

### Auth

Uses better-auth with Discord OAuth only. Server-side session validation via `getSession()` server function. The `_app` layout guard redirects unauthenticated users to `/`.

### Gacha Mechanics

- Pull costs: 1 Fossil (single), 10 Fossils (10-pull)
- Rarities: common (50%), uncommon (30%), rare (15%), epic (4%), legendary (1%)
- Soft pity at 50 pulls, hard pity (guaranteed legendary) at 90
- Rate-up: featured creature gets 50% of its rarity's share
- New user bonus: 10 Fossils, daily login: 3 Fossils

### Database Schema

Auth tables (user, session, account, verification) managed by better-auth. Game tables: creature, banner, banner_pool, user_creature, currency, pity_counter, trade_offer, trade_proposal, trade_history, wishlist, user_xp. Schema defined in `packages/shared/src/db/schema.ts`.

### Discord Bot (`bot/`)

Cloudflare Worker that handles Discord slash commands. Shares the same D1 database as the main app — imports shared code from `@paleo-waifu/shared` and game logic from `src/lib/` via `@/` path alias.

Slash commands: `/pull`, `/pull10`, `/daily`, `/balance`, `/pity`, `/level`, `/leaderboard-xp`, `/leaderboard-collection`, `/help`

Uses Discord Interactions API (webhook-based). Ed25519 signature verification via Web Crypto API. Deferred responses for DB-heavy commands (`/pull`, `/daily`), immediate ephemeral responses for read-only commands.

### Gateway Listener (`gateway/`)

Standalone Node.js process (discord.js) that runs on a homelab server. Connects to Discord Gateway via WebSocket, listens for `MESSAGE_CREATE` events, and calls the bot Worker's `POST /api/xp` endpoint for eligible messages. Handles XP cooldowns (60s per user, in-memory), message length filtering, and sends level-up embeds to the channel.

Built with esbuild. Imports XP constants from `@paleo-waifu/shared/xp`. Deployed as a Docker container via GHCR.

### CI/CD

Four GitHub Actions workflows, triggered by path-filtered pushes to `main`:

- **Deploy Website** (`src/`, `packages/shared/`, `drizzle/`, etc.) — D1 migrations + `wrangler deploy`
- **Deploy Bot** (`bot/`, `packages/shared/`, `src/lib/`, `drizzle/`) — D1 migrations + `wrangler deploy` (bot worker)
- **Gateway Docker** (`gateway/`, `packages/shared/`) — Docker build + GHCR push + repository dispatch to homelab
- **Editor Docker** (`editor/`, `packages/shared/`) — Docker build + GHCR push + repository dispatch to homelab

### Testing

Production integration tests in `tests/production/` using Vitest. Tests hit the live site (or `TEST_BASE_URL` env var) and verify HTTP headers, security headers, SEO meta tags, SSR content, auth redirects, and API behavior. Run with `pnpm test`.

### Static Assets & Caching

- `public/_headers` — Cloudflare Workers Assets header rules (immutable cache for hashed `/assets/*`)
- `public/og-image.png` — Open Graph social preview image
- Creature images stored in R2, served via `cdn.jacobmaynard.dev` custom domain
- Security headers (CSP, X-Frame-Options, etc.) applied globally via root route `headers()`

## Conventions

- **Imports**: Use `@paleo-waifu/shared/*` for shared code (DB schema, types, XP config, battle constants). Use `@/` path alias (maps to `src/`) for main app code. Use `@/lib/rarity-styles` for Tailwind rarity CSS maps.
- **Components**: PascalCase filenames, shadcn/ui with Lucide icons
- **Styling**: Tailwind classes only, dark mode with warm amber theme via OKLCH in `src/styles.css`
- **Formatting**: No semicolons, single quotes, trailing commas (Prettier)
- **Database**: Drizzle ORM with SQLite (D1). Schema in `packages/shared/src/db/schema.ts`. Timestamps use `integer('field', { mode: 'timestamp' }).default(sql\`(unixepoch())\`)`
- **IDs**: Use `nanoid()` for all primary keys
- **Cloudflare bindings**: Access D1 and env vars via `import { env } from 'cloudflare:workers'` in server-side code. Do NOT use `.server.ts` file suffix — TanStack Start import protection blocks it. Use `createServerFn` for server functions callable from client code.
