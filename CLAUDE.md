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
pnpm db:seed:local    # Seed local D1 with creature data
pnpm db:seed:prod     # Seed production D1 with creature data
pnpm lint             # ESLint
pnpm format           # Prettier
pnpm check            # Prettier --write + ESLint --fix
pnpm typecheck        # Typecheck -- IMPORTANT TO USE THIS FOR ALL TYPE CHECKS BECAUSE USING tsc DIRECTLY WILL IGNORE PROJECT CONFIG

# Bot commands
pnpm bot:dev          # Local bot worker dev server
pnpm bot:deploy       # Deploy bot to Cloudflare Workers
pnpm bot:register     # Register slash commands (dev guild)
pnpm bot:register:prod # Register slash commands (global)
pnpm bot:typecheck    # Typecheck bot
```

## Environment

Requires a `.env` file. Copy `.env.example` and fill in values:

- `AUTH_SECRET` — Random string for session signing
- `AUTH_BASE_URL` — App URL (http://localhost:3000 for dev)
- `DISCORD_CLIENT_ID` — Discord OAuth application client ID
- `DISCORD_CLIENT_SECRET` — Discord OAuth application client secret

## Architecture

Prehistoric animal waifu gacha game built with **TanStack Start** (SSR) + **TanStack Router** (file-based routing), React 19, Tailwind CSS v4, deployed to **Cloudflare Workers** with D1 database.

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
- `/api/auth/$` — better-auth catch-all
- `/api/gacha` — POST pull endpoint
- `/api/trade` — POST create/accept/cancel trade

### Code Organization

- `src/routes/` — File-based route definitions
- `src/components/gacha/` — Banner select, pull button, animation, card reveal
- `src/components/collection/` — Grid, creature card, detail modal
- `src/components/encyclopedia/` — Browse and filter all creatures
- `src/components/trade/` — Trade list, offer, card
- `src/components/layout/` — Nav with auth state
- `src/components/landing/` — Hero section
- `src/components/ui/` — shadcn/ui primitives
- `src/lib/` — Auth, gacha logic, types, utilities
- `src/lib/db/` — Drizzle schema and D1 client factory
- `src/store/` — Zustand store (fossils, pull results)
- `python/` — Data pipeline for creature seeding

### Auth

Uses better-auth with Discord OAuth only. Server-side session validation via `getSession()` / `ensureSession()` server functions. The `_app` layout guard redirects unauthenticated users to `/`.

### Gacha Mechanics

- Pull costs: 1 Fossil (single), 10 Fossils (10-pull)
- Rarities: common (50%), uncommon (30%), rare (15%), epic (4%), legendary (1%)
- Soft pity at 50 pulls, hard pity (guaranteed legendary) at 90
- Rate-up: featured creature gets 50% of its rarity's share
- New user bonus: 20 Fossils, daily login: 3 Fossils

### Database Schema

Auth tables (user, session, account, verification) managed by better-auth. Game tables: creature, banner, banner_pool, user_creature, currency, pity_counter, trade_offer, trade_history, wishlist, user_xp.

### Discord Bot (`bot/`)

Cloudflare Worker that handles Discord slash commands. Shares the same D1 database as the main app — imports game logic from `src/lib/` via `@/` path alias (no code duplication).

Slash commands: `/pull`, `/pull10`, `/daily`, `/balance`, `/pity`, `/level`, `/leaderboard-xp`, `/leaderboard-collection`, `/help`

Uses Discord Interactions API (webhook-based). Ed25519 signature verification via Web Crypto API. Deferred responses for DB-heavy commands (`/pull`, `/daily`), immediate ephemeral responses for read-only commands.

### Gateway Listener (`gateway/`)

Standalone Node.js process (discord.js) that runs on a homelab server. Connects to Discord Gateway via WebSocket, listens for `MESSAGE_CREATE` events, and calls the bot Worker's `POST /api/xp` endpoint for eligible messages. Handles XP cooldowns (60s per user, in-memory), message length filtering, and sends level-up embeds to the channel.

Deployed as a Docker container via GHCR. Push to `gateway/` on main triggers: Docker build → push to `ghcr.io/infinitybowman/paleo-waifu-gateway` → repository dispatch to homelab repo → pull and restart.

### CI/CD

Three GitHub Actions workflows, triggered by path-filtered pushes to `main`:

- **Deploy Website** (`src/`, `drizzle/`, etc.) — D1 migrations + `wrangler deploy`
- **Deploy Bot** (`bot/`, `src/lib/`, `drizzle/`) — D1 migrations + `wrangler deploy` (bot worker)
- **Gateway Docker** (`gateway/`) — Docker build + GHCR push + repository dispatch to homelab

## Conventions

- **Imports**: Use `@/` path alias (maps to `src/`)
- **Components**: PascalCase filenames, shadcn/ui with Lucide icons
- **Styling**: Tailwind classes only, dark mode with warm amber theme via OKLCH in `src/styles.css`
- **Formatting**: No semicolons, single quotes, trailing commas (Prettier)
- **Database**: Drizzle ORM with SQLite (D1). Timestamps use `integer('field', { mode: 'timestamp' }).default(sql\`(unixepoch())\`)`
- **IDs**: Use `nanoid()` for all primary keys
- **Cloudflare bindings**: Access D1 and env vars via `import { env } from 'cloudflare:workers'` in server-side code. Do NOT use `.server.ts` file suffix — TanStack Start import protection blocks it. Use `createServerFn` for server functions callable from client code.
