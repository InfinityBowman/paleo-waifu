# PaleoWaifu

A prehistoric animal gacha game. Collect 615+ creatures spanning the Cambrian through the Pleistocene, trade with other players, and build your ultimate paleontology collection.

## Tech Stack

- **Framework**: TanStack Start + Router (file-based routing, SSR)
- **UI**: React 19, Tailwind CSS v4, shadcn/ui, Lucide icons
- **State**: Zustand
- **Auth**: better-auth (Discord OAuth)
- **Database**: Cloudflare D1 + Drizzle ORM
- **Deploy**: Cloudflare Workers
- **Discord Bot**: Cloudflare Worker (slash commands) + Node.js Gateway listener (XP system)
- **Monorepo**: pnpm workspace with shared package (`@paleo-waifu/shared`)
- **CI/CD**: GitHub Actions (auto-deploy website, bot, gateway, and editor on push)

## Features

- **Gacha pulls** — Single or 10-pull with a full pity system (soft pity at 50, hard guarantee at 90)
- **Rate-up banners** — Featured creatures get 50% of their rarity's drop share
- **Collection** — Browse and filter your discovered creatures by rarity and era
- **Encyclopedia** — View all 615+ creatures with real paleontology data and fun facts, shareable creature pages with OG social previews
- **Battles** — Build offense/defense teams, arena PvP with rating system, battle stats and abilities per creature
- **Trading** — Create open trade offers, browse the marketplace, swap creatures with other players
- **Leaderboard** — Top players by XP and collection size
- **Daily rewards** — Log in daily for free fossils
- **Discord bot** — Pull creatures, claim dailies, check balance and pity via slash commands
- **XP & leveling** — Earn XP by chatting in Discord, level up passively alongside the gacha
- **Admin dashboard** — Manage banners, view stats, and moderate the game

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Copy `web/.env.example` and fill in:
   - `AUTH_SECRET` — any random string
   - `AUTH_BASE_URL` — `http://localhost:3000`
   - `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — from the [Discord Developer Portal](https://discord.com/developers/applications) (set redirect URI to `http://localhost:3000/api/auth/callback/discord`)

3. **Create D1 database**

   ```bash
   wrangler d1 create paleo-waifu-db
   # Copy the database_id into wrangler.jsonc
   ```

4. **Run migrations**

   ```bash
   pnpm db:migrate:local
   ```

5. **Start development**

   ```bash
   pnpm dev
   # Open http://localhost:3000
   ```

## Deploy

Deployments are automated via GitHub Actions. Pushing to `main` triggers the relevant workflow based on which files changed:

| Workflow       | Trigger paths                                      | What it does                                                 |
| -------------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Deploy Website | `web/src/`, `packages/shared/`, `web/drizzle/`, etc. | D1 migrations + `wrangler deploy`                            |
| Deploy Bot     | `bot/`, `packages/shared/`, `web/src/lib/`, `web/drizzle/` | D1 migrations + `wrangler deploy` (bot worker)               |
| Gateway Docker | `gateway/`, `packages/shared/`                     | Docker build + push to GHCR + repository dispatch to homelab |
| Editor Docker  | `editor/`, `packages/shared/`                      | Docker build + push to GHCR + repository dispatch to homelab |

### Manual deploy (first time or secrets)

```bash
# Website secrets
wrangler secret put AUTH_SECRET --env production
wrangler secret put AUTH_BASE_URL --env production
wrangler secret put DISCORD_CLIENT_ID --env production
wrangler secret put DISCORD_CLIENT_SECRET --env production

# Bot secrets
cd bot
wrangler secret put DISCORD_APPLICATION_ID --env production
wrangler secret put DISCORD_PUBLIC_KEY --env production
wrangler secret put DISCORD_BOT_TOKEN --env production
wrangler secret put XP_API_SECRET --env production

# Apply remote migrations
pnpm db:migrate:prod
```

### GitHub Actions secrets required

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Workers/D1 permissions
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
- `HOMELAB_DEPLOY_TOKEN` — Fine-grained PAT for triggering repository dispatch on the homelab repo

## Project Structure

```
packages/shared/       # @paleo-waifu/shared — runtime-agnostic shared code
├── src/
│   ├── types.ts       # Rarity, TradeStatus, gacha constants
│   ├── xp.ts          # XP functions and constants
│   ├── db/
│   │   ├── schema.ts  # All Drizzle table definitions
│   │   └── client.ts  # createDb(), Database type
│   └── battle/
│       ├── types.ts   # Battle types (Role, AbilityTemplateData, etc.)
│       └── constants.ts # Battle constants (stat distributions, ability templates)

web/src/               # Main TanStack Start web app
├── components/
│   ├── admin/         # Admin dashboard components
│   ├── collection/    # Collection grid, creature card, detail modal
│   ├── encyclopedia/  # Browse grid, filters, creature detail shared component
│   ├── gacha/         # Banner select, pull button, pull animation, card reveal, pity counter
│   ├── landing/       # Hero section
│   ├── layout/        # Nav with auth state
│   ├── shared/        # Shared components (CreatureCard, CreaturePickerModal)
│   ├── trade/         # Trade list, offer, accept flow
│   └── ui/            # shadcn/ui primitives
├── lib/
│   ├── auth.ts        # better-auth server config
│   ├── auth-client.ts # Client-side auth helpers
│   ├── auth-server.ts # Server-side session helpers
│   ├── gacha.ts       # Pull logic, pity, currency management
│   ├── rarity-styles.ts # Tailwind rarity CSS class maps
│   ├── slug.ts        # Slug derivation for creature URLs
│   └── utils.ts       # cn() utility
├── routes/
│   ├── _public/       # Landing, encyclopedia (grid + creature pages), leaderboard (no auth)
│   ├── _app/          # Gacha, collection, trade, profile, admin (auth guarded)
│   └── api/           # Gacha pull, trade, collection, admin, auth endpoints
├── router.tsx         # Router config with route masks
├── store/             # Zustand store
└── styles.css         # Warm amber OKLCH theme

bot/                   # Discord bot (Cloudflare Worker)
├── src/
│   ├── commands/      # Slash command handlers (pull, daily, balance, pity, level, leaderboard, help)
│   ├── lib/           # Discord types, auth, embeds, XP logic
│   └── index.ts       # Worker entry: signature verification + routing
├── register.ts        # Script to register slash commands with Discord API
└── wrangler.jsonc     # Shares D1 database with main app

gateway/               # Discord Gateway listener (Node.js, runs on homelab)
├── src/
│   ├── index.ts       # Gateway WebSocket connection + MESSAGE_CREATE handler
│   └── xp.ts          # Eligibility checks, cooldowns, XP API calls
└── Dockerfile         # Pushed to GHCR, deployed via repository dispatch

editor/                # Creature editor dashboard (React + Hono)
tools/                 # Dev tooling
├── battle-sim/        # Monte Carlo battle simulator for balance testing
└── balance-ui/        # React dashboard for visualizing simulation results
python/                # Data pipeline for creature scraping, enrichment, image generation, R2 upload
docs/                  # Design docs and reference
web/tests/             # Production integration + E2E tests (Vitest)
```

## Scripts

| Command                  | Description                           |
| ------------------------ | ------------------------------------- |
| `pnpm dev`               | Dev server + editor on localhost:3000 |
| `pnpm build`             | Production build                      |
| `pnpm deploy`            | Build + deploy to Cloudflare Workers  |
| `pnpm db:generate`       | Generate Drizzle migration files      |
| `pnpm db:migrate:local`  | Apply migrations to local D1          |
| `pnpm db:migrate:prod`   | Apply migrations to production D1     |
| `pnpm lint`              | ESLint                                |
| `pnpm format`            | Prettier                              |
| `pnpm check`             | Prettier --write + ESLint --fix       |
| `pnpm typecheck`         | TypeScript type checking              |
| `pnpm test`              | Run production integration tests      |
| `pnpm editor`            | Creature editor UI                    |
| `pnpm bot:dev`           | Local bot worker dev server           |
| `pnpm bot:deploy`        | Deploy bot to Cloudflare Workers      |
| `pnpm bot:register`      | Register slash commands (dev guild)   |
| `pnpm bot:register:prod` | Register slash commands (global)      |
| `pnpm bot:typecheck`     | Typecheck bot                         |
| `pnpm gateway:dev`       | Local gateway dev server              |
| `pnpm gateway:build`     | Build gateway with esbuild            |
| `pnpm gateway:typecheck` | Typecheck gateway                     |
