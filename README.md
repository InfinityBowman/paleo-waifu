# PaleoWaifu

A prehistoric animal waifu gacha game. Collect 101 creatures spanning the Cambrian through the Pleistocene, trade with other players, and build your ultimate paleontology collection.

## Tech Stack

- **Framework**: TanStack Start + Router (file-based routing, SSR)
- **UI**: React 19, Tailwind CSS v4, shadcn/ui, Lucide icons
- **State**: Zustand
- **Auth**: better-auth (Discord OAuth)
- **Database**: Cloudflare D1 + Drizzle ORM
- **Deploy**: Cloudflare Workers
- **Discord Bot**: Cloudflare Worker (slash commands) + Node.js Gateway listener (XP system)
- **CI/CD**: GitHub Actions (auto-deploy website, bot, and gateway on push)

## Features

- **Gacha pulls** — Single or 10-pull with a full pity system (soft pity at 50, hard guarantee at 90)
- **Rate-up banners** — Featured creatures get 50% of their rarity's drop share
- **Collection** — Browse and filter your discovered creatures by rarity and era
- **Encyclopedia** — View all 101 creatures with real paleontology data and fun facts
- **Trading** — Create open trade offers, browse the marketplace, swap creatures with other players
- **Daily rewards** — Log in daily for free fossils
- **Discord bot** — Pull creatures, claim dailies, check balance and pity via slash commands
- **XP & leveling** — Earn XP by chatting in Discord, level up passively alongside the gacha

## Setup

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment**

   ```bash
   cp .env.example .env
   ```

   Fill in:
   - `AUTH_SECRET` — any random string
   - `AUTH_BASE_URL` — `http://localhost:3000`
   - `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — from the [Discord Developer Portal](https://discord.com/developers/applications) (set redirect URI to `http://localhost:3000/api/auth/callback/discord`)

3. **Create D1 database**

   ```bash
   wrangler d1 create paleo-waifu-db
   # Copy the database_id into wrangler.jsonc
   ```

4. **Run migrations and seed**

   ```bash
   pnpm db:migrate:local
   pnpm db:seed:local
   ```

5. **Start development**

   ```bash
   pnpm dev
   # Open http://localhost:3000
   ```

## Deploy

Deployments are automated via GitHub Actions. Pushing to `main` triggers the relevant workflow based on which files changed:

| Workflow       | Trigger paths                              | What it does                                                 |
| -------------- | ------------------------------------------ | ------------------------------------------------------------ |
| Deploy Website | `src/`, `drizzle/`, `wrangler.jsonc`, etc. | D1 migrations + `wrangler deploy`                            |
| Deploy Bot     | `bot/`, `src/lib/`, `drizzle/`             | D1 migrations + `wrangler deploy` (bot worker)               |
| Gateway Docker | `gateway/`                                 | Docker build + push to GHCR + repository dispatch to homelab |

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

# Apply remote migrations and seed
pnpm db:migrate:prod
pnpm db:seed:prod
```

### GitHub Actions secrets required

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token with Workers/D1 permissions
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID
- `HOMELAB_DEPLOY_TOKEN` — Fine-grained PAT for triggering repository dispatch on the homelab repo

## Project Structure

```
src/
├── components/
│   ├── collection/    # Collection grid, creature card, detail modal
│   ├── encyclopedia/  # Browse and filter all creatures
│   ├── gacha/         # Banner select, pull button, pull animation, card reveal, pity counter
│   ├── landing/       # Hero section
│   ├── layout/        # Nav with auth state
│   ├── trade/         # Trade list, offer, accept flow
│   └── ui/            # shadcn/ui primitives
├── lib/
│   ├── db/            # Drizzle schema + D1 client
│   ├── auth.ts        # better-auth server config
│   ├── auth-client.ts # Client-side auth helpers
│   ├── auth-server.ts # Server-side session helpers
│   ├── gacha.ts       # Pull logic, pity, currency management
│   ├── types.ts       # Rarity types, rates, constants
│   └── utils.ts       # cn() utility
├── routes/
│   ├── _public/       # Landing page, encyclopedia (no auth)
│   ├── _app/          # Gacha, collection, trade, profile (auth guarded)
│   └── api/           # Gacha pull, trade, auth endpoints
├── store/             # Zustand store
└── styles.css         # Warm amber OKLCH theme
python/                # Data pipeline for creature seeding

bot/                   # Discord bot (Cloudflare Worker)
├── src/
│   ├── commands/      # Slash command handlers (pull, daily, balance, pity, level, help)
│   ├── lib/           # Discord types, auth, embeds, XP logic
│   └── index.ts       # Worker entry: signature verification + routing
├── register.ts        # Script to register slash commands with Discord API
└── wrangler.jsonc     # Shares D1 database with main app

gateway/               # Discord Gateway listener (Node.js, runs on homelab)
├── src/
│   ├── index.ts       # Gateway WebSocket connection + MESSAGE_CREATE handler
│   └── xp.ts          # Eligibility checks, cooldowns, XP API calls
└── Dockerfile         # Pushed to GHCR, deployed via repository dispatch

docs/                  # Detailed reference docs
```

## Scripts

| Command                  | Description                          |
| ------------------------ | ------------------------------------ |
| `pnpm dev`               | Dev server on http://localhost:3000  |
| `pnpm build`             | Production build                     |
| `pnpm deploy`            | Build + deploy to Cloudflare Workers |
| `pnpm db:generate`       | Generate Drizzle migration files     |
| `pnpm db:migrate:local`  | Apply migrations to local D1         |
| `pnpm db:migrate:prod`   | Apply migrations to production D1    |
| `pnpm db:seed:local`     | Seed local D1 with creature data     |
| `pnpm lint`              | ESLint                               |
| `pnpm format`            | Prettier                             |
| `pnpm check`             | Prettier --write + ESLint --fix      |
| `pnpm bot:dev`           | Local bot worker dev server          |
| `pnpm bot:deploy`        | Deploy bot to Cloudflare Workers     |
| `pnpm bot:register`      | Register slash commands (dev guild)  |
| `pnpm bot:register:prod` | Register slash commands (global)     |
| `pnpm bot:typecheck`     | Typecheck bot                        |
