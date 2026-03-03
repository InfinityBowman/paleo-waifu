# Creature Editor

Local dev tool for managing the creature database. Reads and writes `python/data/creatures_enriched.json` as the source of truth.

## Quick Start

```bash
# From project root
pnpm editor
```

Opens at [http://localhost:4200](http://localhost:4200). The Hono API server runs on port 4100.

## Features

- **Browse** — Searchable, sortable table of all creatures with filters for era, rarity, and diet
- **Edit** — Update any creature field (name, stats, description, rarity, etc.)
- **Add** — Create new creatures with all metadata fields
- **Delete** — Remove creatures from the JSON file and optionally from R2
- **Image Upload** — Drag-and-drop images, auto-converted to WebP and uploaded to production R2
- **Seed Database** — One-click seed to local or production D1

## Architecture

```
src/
  shared/
    types.ts          # Creature interface shared between server and client
  server/
    index.ts          # Hono API (port 4100)
    creatures.ts      # JSON read/write with atomic writes and write queue
    images.ts         # sharp WebP conversion + R2 upload via wrangler CLI
    seed.ts           # Generates seed.sql (deterministic IDs) + executes against D1
  client/
    App.tsx           # Two-view layout (list / edit)
    components/       # CreatureList, CreatureForm, ImageUploader, SeedPanel, etc.
    lib/              # API client + re-exported shared types
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/creatures` | List all creatures + stats |
| GET | `/api/creatures/:slug` | Get single creature |
| POST | `/api/creatures` | Add new creature |
| PUT | `/api/creatures/:slug` | Update creature |
| DELETE | `/api/creatures/:slug` | Delete creature (`?deleteImage=true` to also remove from R2) |
| POST | `/api/creatures/:slug/image` | Upload image (multipart) |
| GET | `/api/creatures/:slug/image` | Serve local image for preview |
| POST | `/api/seed` | Seed D1 (`{ "target": "local" | "prod" }`) |

Slugs are derived from scientific names: `"Tyrannosaurus rex"` → `tyrannosaurus-rex`.

## Image Upload Flow

1. Drop/select an image in the editor
2. Server converts to WebP (quality 85) via sharp
3. Computes aspect ratio from dimensions
4. Saves to `python/data/images/{slug}.webp`
5. Uploads to production R2 (`paleo-waifu-images-prod`)
6. Updates `imageUrl` and `imageAspectRatio` in the JSON file

Requires `wrangler login` for R2 access.

## Seeding

The seed flow generates `seed.sql` at the project root using deterministic SHA256-based IDs (matching the original Python `generate_seed.py`), then runs `pnpm db:seed:local` or `pnpm db:seed:prod`.
