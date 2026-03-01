# PaleoWaifu Discord Bot

Cloudflare Worker that handles Discord slash commands for the PaleoWaifu gacha game. Uses the Discord Interactions API (webhook-based) — no persistent connection needed.

## Commands

| Command    | Description                           | Visibility |
| ---------- | ------------------------------------- | ---------- |
| `/balance` | Check your Fossil balance             | Ephemeral  |
| `/pity`    | Check pity counters for active banner | Ephemeral  |
| `/daily`   | Claim daily 3 free Fossils            | Ephemeral  |
| `/pull`    | Pull a creature (1 Fossil)            | Public     |
| `/pull10`  | Pull 10 creatures (10 Fossils)        | Public     |

## Setup

### Prerequisites

- Same Discord application used for the main app's OAuth
- **Message Content Intent** enabled under Bot settings in the Developer Portal (required for the Gateway listener to read message content for XP)

### Bot Invite

Use guild install with `bot` + `applications.commands` scopes and these bot permissions:

| Permission    | Reason                                          |
| ------------- | ----------------------------------------------- |
| View Channels | See channels to send messages in                |
| Send Messages | Slash command responses, level-up messages      |
| Embed Links   | Rich embeds for creature cards and pull results |

Invite URL (permissions integer `19456` = View Channels + Send Messages + Embed Links):

```
https://discord.com/oauth2/authorize?client_id=YOUR_APP_ID&permissions=19456&integration_type=0&scope=bot+applications.commands
```

### 1. Install dependencies

```bash
cd bot && pnpm install
```

### 2. Create `bot/.env`

```
DISCORD_APPLICATION_ID=<same as DISCORD_CLIENT_ID from main app>
DISCORD_PUBLIC_KEY=<from Discord Developer Portal → General Information>
DISCORD_BOT_TOKEN=<from Discord Developer Portal → Bot>
DISCORD_DEV_GUILD_ID=<right-click server → Copy Server ID>
```

### 3. Set Wrangler secrets (one-time)

```bash
wrangler secret put DISCORD_APPLICATION_ID -c wrangler.jsonc --env production
wrangler secret put DISCORD_PUBLIC_KEY -c wrangler.jsonc --env production
wrangler secret put DISCORD_BOT_TOKEN -c wrangler.jsonc --env production
```

### 4. Deploy

```bash
pnpm bot:deploy
```

### 5. Set Interactions Endpoint URL

In Discord Developer Portal → General Information → Interactions Endpoint URL, paste the deployed Worker URL.

### 6. Register commands

```bash
pnpm bot:register        # Dev guild (instant)
pnpm bot:register:prod   # Global (up to 1 hour to propagate)
```

## Development

```bash
pnpm bot:dev          # Local dev server (can't receive Discord interactions)
pnpm bot:typecheck    # Type check
pnpm bot:deploy       # Deploy code changes
pnpm bot:register     # Re-register commands (only needed when adding/removing/renaming commands)
```

### Updating the bot

- **Code changes to existing commands:** `pnpm bot:deploy`
- **Adding/removing/renaming commands:** Update `register.ts`, then `pnpm bot:deploy && pnpm bot:register`

## Architecture

- Shares the same D1 database as the main app
- Imports gacha logic directly from `src/lib/gacha.ts` via `@/` path alias (no code duplication)
- Resolves Discord users to app users via the `account` table (`providerId = 'discord'`)
- Users must have logged into the web app at least once for their Discord ID to be linked

### Deferred vs Immediate Commands

- **Immediate** (`/balance`, `/pity`): Query D1 and respond within Discord's 3-second window
- **Deferred** (`/pull`, `/pull10`, `/daily`): Return a "thinking..." response immediately, do DB work in `ctx.waitUntil()`, then PATCH the follow-up via Discord REST API
