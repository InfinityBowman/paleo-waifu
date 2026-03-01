# PaleoWaifu Gateway Listener

Node.js service that connects to the Discord Gateway via WebSocket to track message activity and award XP. Runs as a Docker container on the homelab.

## How It Works

```
Discord Gateway ──MESSAGE_CREATE──▶ Gateway Listener (homelab)
                                        │
                                        ▼
                                   Eligibility check:
                                   - Not a bot
                                   - In a guild (not DM)
                                   - Message >= 5 chars
                                   - 60s cooldown per user
                                        │
                                        ▼ (if eligible)
                                   POST /api/xp ──▶ Bot Worker (Cloudflare)
                                                        │
                                                        ▼
                                                   D1: upsert user_xp
                                                   D1: recalculate level
                                                        │
                                                        ▼
                                   ◀── { xp, level, leveledUp } ──┘
                                        │
                                        ▼ (if leveledUp)
                                   Send level-up embed to channel
```

## XP Rules

| Rule | Value |
|---|---|
| XP per eligible message | 15–25 (random) |
| Cooldown | 60 seconds per user |
| Minimum message length | 5 characters |
| Bot messages | Ignored |
| DMs | Ignored |
| Unlinked users | Ignored (404 from API) |

## Level Curve

XP required for level N = `100 × N²`

| Level | Total XP | Approx. messages |
|---|---|---|
| 1 | 100 | ~5 |
| 2 | 400 | ~20 |
| 5 | 2,500 | ~125 |
| 10 | 10,000 | ~500 |
| 20 | 40,000 | ~2,000 |

## Deployment

The gateway is built and deployed automatically via CI/CD:

1. Push changes to `gateway/` on main
2. GitHub Actions builds the Docker image and pushes to `ghcr.io/infinitybowman/paleo-waifu-gateway:latest`
3. Repository dispatch triggers the homelab to pull the new image and restart the container

### Manual deployment

```bash
ssh homelab
cd /opt/homelab/repo/services/paleo-gateway
docker compose pull
docker compose up -d
```

### First-time setup

1. **Enable Message Content Intent** in the [Discord Developer Portal](https://discord.com/developers/applications) under Bot settings
2. **Set the `XP_API_SECRET`** on the bot Worker:
   ```bash
   cd bot
   wrangler secret put XP_API_SECRET -c wrangler.jsonc --env production
   ```
3. **Create `.env` on the homelab** at `/opt/homelab/repo/services/paleo-gateway/.env`:
   ```
   DISCORD_BOT_TOKEN=<same token as the bot Worker>
   XP_API_URL=<bot Worker URL>/api/xp
   XP_API_SECRET=<same secret set in step 2>
   ```
4. **Set the `HOMELAB_DEPLOY_TOKEN` secret** in the paleo-waifu repo (Settings > Secrets > Actions) — a fine-grained PAT with Contents read/write access to the home-lab repo

### Checking logs

```bash
ssh homelab
docker logs homelab-paleo-gateway
docker logs -f homelab-paleo-gateway  # follow
```

## Local Development

```bash
cd gateway
npm install
cp .env.example .env  # fill in values
npm run dev           # runs with tsx watch
```

## Architecture Notes

- **Cooldown is in-memory** — losing state on restart just means a few extra XP awards, which is fine
- **404 from the XP API keeps the cooldown** — prevents hammering the API for unlinked Discord users
- **5xx/429 from the XP API clears the cooldown** — users aren't penalized for transient server errors
- **Level is computed atomically** in the database upsert, not in application code
- **Graceful shutdown** on SIGTERM — `client.destroy()` sends a proper Gateway close frame so the session can resume faster on next start
