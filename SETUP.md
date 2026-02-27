# PaleoWaifu — Setup & Summary

## What was built

Built `paleo-waifu` by forking `syntch-template` and rewiring it entirely for a prehistoric animal waifu gacha game.

### Removed from template
- Polar payments (SDK, plugin, webhooks)
- Email/password auth (login/signup forms)
- AI chat (OpenRouter, SSE streaming, chat panel)
- Credit system, dashboard, settings pages
- Theme toggler (forced dark mode)

### Added/replaced

**Auth** — Discord OAuth only via better-auth (`src/lib/auth.ts`)

**Database** — 13 tables total: 4 better-auth tables + 9 game tables (creature, banner, banner_pool, user_creature, currency, pity_counter, trade_offer, trade_history, wishlist)

**Routes:**
- `_public/` — Landing page, Encyclopedia (no auth needed)
- `_app/` — Gacha, Collection, Trade, Profile (auth guarded)
- `api/gacha` — Pull + daily claim endpoints
- `api/trade` — Create/accept/cancel trade endpoints

**Gacha logic** (`src/lib/gacha.ts`) — Full pity system (soft at 50, hard at 90), rate-up (50% featured share), currency management, atomic deductions

**Components** — Nav with Discord login, Hero landing, BannerSelect, PullButton, PullAnimation with staggered CardReveal, CollectionGrid with filters, EncyclopediaGrid, TradeList with create/accept/cancel

**Data** — 101 prehistoric creatures in `python/data/creatures.json` spanning Cambrian through Pleistocene, with waifu personalities, real paleontology data, and fun facts. Seed SQL generated.

**Theme** — Warm amber OKLCH palette (shifted from template purple)

## Next steps to run locally

1. Copy the env example and fill in your values:
   ```bash
   cp .env.example .env
   ```
   - `AUTH_SECRET` — any random string
   - `AUTH_BASE_URL` — `http://localhost:3000`
   - `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — from [Discord Developer Portal](https://discord.com/developers/applications) (set redirect URI to `http://localhost:3000/api/auth/callback/discord`)

2. Create the D1 database and update `wrangler.jsonc` with the ID:
   ```bash
   wrangler d1 create paleo-waifu-db
   ```

3. Run migrations and seed data:
   ```bash
   pnpm db:migrate:local
   pnpm db:seed:local
   ```

4. Start the dev server:
   ```bash
   pnpm dev
   ```

## Deploying to Cloudflare Workers

1. Set secrets on the worker:
   ```bash
   wrangler secret put AUTH_SECRET
   wrangler secret put AUTH_BASE_URL
   wrangler secret put DISCORD_CLIENT_ID
   wrangler secret put DISCORD_CLIENT_SECRET
   ```

2. Run remote migration and seed:
   ```bash
   pnpm db:migrate:remote
   wrangler d1 execute paleo-waifu-db --remote --file=./drizzle/seed.sql
   ```

3. Deploy:
   ```bash
   pnpm deploy
   ```
