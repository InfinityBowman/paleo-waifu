# PaleoWaifu

A prehistoric animal waifu gacha game. Collect 101 creatures spanning the Cambrian through the Pleistocene, trade with other players, and build your ultimate paleontology collection.

## Tech Stack

- **Framework**: TanStack Start + Router (file-based routing, SSR)
- **UI**: React 19, Tailwind CSS v4, shadcn/ui, Lucide icons
- **State**: Zustand
- **Auth**: better-auth (Discord OAuth)
- **Database**: Cloudflare D1 + Drizzle ORM
- **Deploy**: Cloudflare Workers

## Features

- **Gacha pulls** — Single or 10-pull with a full pity system (soft pity at 50, hard guarantee at 90)
- **Rate-up banners** — Featured creatures get 50% of their rarity's drop share
- **Collection** — Browse and filter your discovered creatures by rarity and era
- **Encyclopedia** — View all 101 creatures with real paleontology data and fun facts
- **Trading** — Create open trade offers, browse the marketplace, swap creatures with other players
- **Daily rewards** — Log in daily for free fossils

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

```bash
# Set secrets
wrangler secret put AUTH_SECRET
wrangler secret put AUTH_BASE_URL
wrangler secret put DISCORD_CLIENT_ID
wrangler secret put DISCORD_CLIENT_SECRET

# Apply remote migrations and seed
pnpm db:migrate:remote
wrangler d1 execute paleo-waifu-db --remote --file=./drizzle/seed.sql

# Deploy
pnpm deploy
```

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
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Dev server on http://localhost:3000 |
| `pnpm build` | Production build |
| `pnpm deploy` | Build + deploy to Cloudflare Workers |
| `pnpm db:generate` | Generate Drizzle migration files |
| `pnpm db:migrate:local` | Apply migrations to local D1 |
| `pnpm db:migrate:remote` | Apply migrations to remote D1 |
| `pnpm db:seed:local` | Seed local D1 with creature data |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm check` | Prettier --write + ESLint --fix |
