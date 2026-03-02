# Python Data Pipeline

Scripts for scraping, processing, and uploading prehistoric creature data and images for the paleo-waifu gacha game.

## Prerequisites

- Python 3.12+ with [uv](https://docs.astral.sh/uv/)
- `wrangler` authenticated (`wrangler login`)
- R2 bucket created: `npx wrangler r2 bucket create paleo-waifu-images`

## Setup

```bash
cd python
uv sync
```

## Pipeline Overview

```
scrape_creatures.py → creatures_enriched.json (393 NHM + Wikipedia)
                          ↓
scrape_pbdb.py      → creatures_enriched.json (+ PBDB genera)
                          ↓
download_images.py  → data/images/*.webp
                          ↓
upload_to_r2.py     → R2 bucket + imageUrl in creatures_enriched.json
                          ↓
generate_seed.py    → seed.sql
                          ↓
pnpm db:seed:local  → D1 database
```

## Step 1: Scrape Creature Data

```bash
uv run python scripts/scrape_creatures.py
```

Sources:

- **NHM Dino Directory** (via Jurassic Park CSV) — ~309 dinosaurs with rich structured data (diet, period, size, weight, description, pronunciation, name meaning)
- **Wikipedia** — ~84 non-dinosaur creatures (pterosaurs, marine reptiles, prehistoric mammals, Paleozoic creatures, birds)
- **Wikimedia Commons** — Life reconstruction images for all creatures

What it does:

1. Downloads NHM dinosaur CSV from GitHub if not cached
2. Scrapes each NHM creature page for detailed data
3. Scrapes Wikipedia for non-dinosaur creatures
4. Searches Wikimedia Commons for life reconstruction images (prefers "restoration" art over fossil photos)
5. Assigns rarity based on creature notability (legendary/epic/rare/uncommon/common)
6. Writes `data/creatures_enriched.json`

Options:

- `uv run python scripts/scrape_creatures.py 5` — Limit to first N creatures (useful for testing)

Rate limiting: 1s between Wikipedia API requests. Responses are cached in `data/cache/` to avoid re-fetching.

Output: `data/creatures_enriched.json` (~393 creatures)

Rarity distribution (bottom-heavy by design for gacha):

- common: ~49%
- uncommon: ~30%
- rare: ~11%
- epic: ~6%
- legendary: ~4%

## Step 1b: Add PBDB Creatures

```bash
uv run python scripts/scrape_pbdb.py              # Dry run (preview only)
uv run python scripts/scrape_pbdb.py --yolo        # Actually write to creatures_enriched.json
uv run python scripts/scrape_pbdb.py --min-occs 5  # Override min occurrence threshold
```

Queries the [Paleobiology Database](https://paleobiodb.org/) for genera across 12 target clades (Dinosauria, Pterosauria, marine reptiles, synapsids, trilobites, etc.) and merges new genera into `creatures_enriched.json`.

**Default is dry-run** — shows you what would be added without writing anything. Pass `--yolo` to actually merge.

Filtering:

- Per-clade minimum fossil occurrences (n_occs >= 2-5 depending on clade size)
- Per-clade genus count caps (prevents any single group from dominating)
- Global cap: ~450 new genera
- Deduplication against existing creatures
- Excludes extant (still-living) taxa

Rarity is assigned using a composite score of fossil occurrence count + Wikipedia article existence. No new legendaries — legendary status is reserved for manually curated iconic creatures.

After running, use `enrich_descriptions.py` to backfill Wikipedia descriptions for the new creatures.

## Step 2: Download Images

```bash
uv run python scripts/download_images.py
```

Downloads images from Wikimedia Commons URLs in `creatures_enriched.json`, processes them, and saves locally.

Processing:

- Resizes to 600x800 (3:4 aspect ratio to match frontend card display)
- Center crops to exact dimensions
- Converts to WebP (quality 85)
- Handles RGBA/palette images by compositing onto white background

Options:

- `uv run python scripts/download_images.py 10` — Limit to first N creatures

Output: `data/images/{slug}.webp`

**Important: Wikimedia rate limiting is aggressive.** The script uses 3s delays between requests and exponential backoff (30s/60s/120s) on 429 responses. You will likely need to run the script multiple times — it skips already-downloaded images, so each run picks up where the last left off. Expect 3-5 runs to get all ~390 images.

## Step 3: Upload to R2

```bash
uv run python scripts/upload_to_r2.py
```

Uploads processed images to the `paleo-waifu-images` R2 bucket via `wrangler r2 object put` and updates `creatures_enriched.json` with Worker-served URLs.

Images are served through the app's Worker (not a public R2 bucket):

- R2 key: `creatures/{slug}.webp`
- URL in DB: `/api/images/creatures/{slug}.webp`
- Served by: `src/routes/api/images/$.ts` (reads from `env.IMAGES` R2 binding)

Options:

- `uv run python scripts/upload_to_r2.py --dry-run` — Preview without uploading
- `uv run python scripts/upload_to_r2.py --bucket OTHER_BUCKET` — Use a different bucket

## Step 4: Generate Seed SQL

```bash
uv run python scripts/generate_seed.py
```

Reads `creatures_enriched.json` (falls back to `creatures.json`) and generates `seed.sql` at the project root with INSERT statements for:

- All creatures (with imageUrl from R2 upload)
- A default "Mesozoic Mayhem" banner containing all creatures

## Step 5: Seed the Database

```bash
# From project root
pnpm db:seed:local    # Local D1
pnpm db:seed:remote   # Remote D1 (production)
```

## File Structure

```
python/
├── pyproject.toml
├── README.md
├── scripts/
│   ├── scrape_creatures.py     # Step 1: Scrape NHM + Wikipedia data
│   ├── scrape_pbdb.py          # Step 1b: Add PBDB genera
│   ├── download_images.py      # Step 2: Download & process images
│   ├── upload_to_r2.py         # Step 3: Upload to R2, set imageUrl
│   └── generate_seed.py        # Step 4: Generate seed.sql
└── data/
    ├── creatures.json           # Original 101 creatures (reference)
    ├── creatures_enriched.json  # Pipeline output (393 creatures) — tracked in git
    ├── cache/                   # Cached API responses — gitignored
    ├── images/                  # Downloaded WebP images — gitignored
    └── nhm_dinosaurs.csv        # NHM dataset download — gitignored
```

## Wrangler Config

The R2 bucket binding in `wrangler.jsonc`:

```jsonc
"r2_buckets": [
  {
    "binding": "IMAGES",
    "bucket_name": "paleo-waifu-images"
  }
]
```

The `IMAGES: R2Bucket` type is declared in `src/env.d.ts`.

## Reproducing From Scratch

```bash
cd python
uv sync
uv run python scripts/scrape_creatures.py        # ~15 min (API rate limits)
uv run python scripts/scrape_pbdb.py --yolo       # ~10-20 min (PBDB + Wikipedia checks)
uv run python scripts/enrich_descriptions.py      # backfill descriptions for new creatures
uv run python scripts/download_images.py          # ~20-40 min (run multiple times)
uv run python scripts/upload_to_r2.py             # ~5 min
uv run python scripts/generate_seed.py            # instant
cd .. && pnpm db:seed:local                        # seed local DB
```
