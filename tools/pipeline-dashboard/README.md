# Creature Editor

CMS for managing the PaleoWaifu creature database. Connects to production D1 via the Cloudflare REST API and uploads images to R2 via S3-compatible credentials.

## Quick Start

```bash
# From project root (runs main app + editor together)
pnpm dev

# Or editor only
pnpm editor
```

Editor UI at [http://localhost:4200](http://localhost:4200), API server at port 4100.

## Auth

Discord OAuth — reuses the same Discord app as the main site. Only users with `admin` or `editor` role in D1 can access the editor. Sessions are signed JWTs stored in an `editor_session` cookie (7-day TTL).

## Features

- **Browse** — Searchable, sortable table of all 600+ creatures with filters for era, rarity, and diet
- **Edit** — Update any creature field (name, stats, description, rarity, etc.)
- **Add** — Create new creatures with all metadata fields
- **Delete** — Remove creatures from D1 and optionally from R2
- **Image Upload** — Drag-and-drop images, auto-converted to WebP via sharp and uploaded to R2
- **R2 Management** — Sync all local images to R2, scan for orphaned objects and delete individually

## Architecture

```
src/
  shared/
    types.ts              # Creature type + slugify, shared between server and client
  server/
    index.ts              # Hono API server (port 4100)
    auth.ts               # Discord OAuth + JWT sessions + requireAuth middleware
    creature-repo.ts      # CRUD operations against D1 (with in-memory cache)
    db.ts                 # Drizzle ORM setup with D1 HTTP shim
    d1-http-shim.ts       # D1Database interface over Cloudflare REST API
    r2.ts                 # S3-compatible R2 client (upload, delete, list)
    images.ts             # sharp WebP conversion, R2 upload, orphan detection
    env.ts                # Environment variable loading + validation
    vendor/schema.ts      # Copied from main app's schema (via predev script)
  client/
    App.tsx               # Auth state machine + view routing
    components/           # CreatureList, CreatureForm, ImageUploader, R2Panel, etc.
    lib/api.ts            # Fetch wrappers for all API endpoints
    lib/types.ts          # Re-exported types + toCdnUrl helper
```

## API Endpoints

All `/api/*` routes require authentication.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/me` | Current user info |
| GET | `/api/creatures` | List all creatures + stats |
| GET | `/api/creatures/:slug` | Get single creature |
| POST | `/api/creatures` | Create creature |
| PUT | `/api/creatures/:slug` | Update creature |
| DELETE | `/api/creatures/:slug` | Delete creature (`?deleteImage=true` to remove from R2) |
| POST | `/api/creatures/:slug/image` | Upload image (multipart, max 20 MB, JPEG/PNG/WebP/GIF) |
| GET | `/api/creatures/:slug/image` | Serve local image preview |
| POST | `/api/creatures/:slug/push-r2` | Push existing local image to R2 |
| POST | `/api/r2/sync` | Sync all local images to R2 (SSE progress stream) |
| GET | `/api/r2/orphans` | List orphaned R2 objects |
| DELETE | `/api/r2/orphans/:key` | Delete a single orphaned R2 object |

Slugs are derived from scientific names: `"Tyrannosaurus rex"` → `tyrannosaurus-rex`.

## Image Flow

1. Drop/select an image in the editor
2. Server validates file size (20 MB max) and MIME type
3. Converts to WebP (quality 85) via sharp, computes aspect ratio
4. Saves locally to `IMAGES_DIR/{slug}.webp`
5. Uploads to R2 (`paleo-waifu-images-prod/creatures/{slug}.webp`)
6. Updates `imageUrl` and `imageAspectRatio` in D1
7. Client displays images via CDN (`cdn.jacobmaynard.dev`)

## Deployment

Deployed on the homelab as a Docker container via GHCR. Pushes to `tools/pipeline-dashboard/` on main trigger the GitHub Actions workflow which builds and pushes `ghcr.io/infinitybowman/paleo-waifu-editor:latest`, then dispatches to the homelab repo for pull + restart.

Runs behind Traefik reverse proxy with Cloudflare Tunnel at `https://editor.jacobmaynard.dev`.

## Environment Variables

Copy `.env.example` and fill in values. Required:

| Variable | Description |
|----------|-------------|
| `CF_ACCOUNT_ID` | Cloudflare account ID |
| `CF_D1_DATABASE_ID` | Production D1 database ID |
| `CF_API_TOKEN` | Cloudflare API token (D1 edit scope) |
| `R2_ACCESS_KEY_ID` | R2 S3-compatible access key |
| `R2_SECRET_ACCESS_KEY` | R2 S3-compatible secret key |
| `DISCORD_CLIENT_ID` | Discord OAuth app client ID |
| `DISCORD_CLIENT_SECRET` | Discord OAuth app client secret |
| `AUTH_SECRET` | Random string for JWT signing |
| `EDITOR_URL` | Public URL (`http://localhost:4200` for dev) |
