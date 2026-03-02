import { resolve } from 'node:path'

export type StageStatus = 'idle' | 'running' | 'success' | 'failed'

export interface StageArg {
  name: string
  flag: string
  type: 'number' | 'boolean'
  description: string
  default?: number | boolean
}

export interface ArtifactSpec {
  path: string
  description: string
  glob?: string
}

export interface StageDefinition {
  id: string
  name: string
  description: string
  details: string[]
  command: string
  args: string[]
  cwd: string
  dependsOn: string[]
  userArgs: StageArg[]
  artifacts: ArtifactSpec[]
  estimatedDuration: string
}

export interface StageState {
  status: StageStatus
  startedAt?: number
  finishedAt?: number
  exitCode?: number | null
  pid?: number
  error?: string
}

// Resolve paths relative to the project root
const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..')
const PYTHON_DIR = resolve(PROJECT_ROOT, 'python')

export const stages: StageDefinition[] = [
  {
    id: 'scrape-creatures',
    name: 'Scrape Creatures',
    description:
      'Scrape NHM Dino Directory + Wikipedia for creature data, find Wikimedia Commons images, assign rarities',
    details: [
      'Phase 1: Downloads NHM CSV and scrapes ~309 dinosaurs with diet, period, size, weight, description',
      'Phase 2: Scrapes ~84 non-dinosaurs from Wikipedia (pterosaurs, marine reptiles, mammals, Paleozoic, birds)',
      'Phase 3: Searches Wikimedia Commons for life restoration artwork for each creature',
      'Phase 4: Assigns 5-tier rarity based on notability (common 49%, uncommon 30%, rare 11%, epic 6%, legendary 4%)',
      'API responses cached in data/cache/ — re-runs skip already-fetched creatures',
      'Rate limited: 1s between Wikipedia requests',
    ],
    command: 'uv',
    args: ['run', 'python', 'scripts/scrape_creatures.py'],
    cwd: PYTHON_DIR,
    dependsOn: [],
    userArgs: [
      {
        name: 'limit',
        flag: '',
        type: 'number',
        description: 'Limit to first N creatures (for testing)',
      },
    ],
    artifacts: [
      {
        path: 'python/data/creatures_enriched.json',
        description: 'Enriched creature data',
      },
    ],
    estimatedDuration: '~15 min',
  },
  {
    id: 'scrape-pbdb',
    name: 'Scrape PBDB',
    description:
      'Query Paleobiology Database for additional genera across 12 clades, merge into creature data',
    details: [
      'Queries 12 target clades: Dinosauria, Pterosauria, Plesiosauria, Ichthyosauria, Mosasauridae, Synapsida, Crocodylomorpha, Temnospondyli, Placodermi, Mammalia, Trilobita, Eurypterida',
      'Per-clade occurrence filters and genus caps prevent any group from dominating',
      'Global cap: ~450 new genera maximum',
      'Deduplicates against existing creatures and excludes extant taxa',
      'Checks Wikipedia article existence for rarity scoring (fossil occurrences + Wikipedia presence)',
      'No new legendaries — those are reserved for manually curated iconic creatures',
      'Default is dry-run (preview only). Pass --yolo to actually write to creatures_enriched.json',
    ],
    command: 'uv',
    args: ['run', 'python', 'scripts/scrape_pbdb.py'],
    cwd: PYTHON_DIR,
    dependsOn: ['scrape-creatures'],
    userArgs: [
      {
        name: 'yolo',
        flag: '--yolo',
        type: 'boolean',
        description: 'Actually write results (default is dry-run preview)',
        default: false,
      },
      {
        name: 'min-occs',
        flag: '--min-occs',
        type: 'number',
        description: 'Minimum fossil occurrence threshold',
      },
    ],
    artifacts: [
      {
        path: 'python/data/creatures_enriched.json',
        description: 'Creature data with PBDB additions',
      },
    ],
    estimatedDuration: '~10-20 min',
  },
  {
    id: 'enrich-descriptions',
    name: 'Enrich Descriptions',
    description:
      'Backfill missing or low-quality creature descriptions from Wikipedia',
    details: [
      'Targets creatures with empty or short (<100 char) descriptions',
      'Fetches plaintext extracts from Wikipedia API (tries scientific name, then genus, then common name)',
      'Cleans up IPA pronunciation noise and formatting artifacts',
      'Truncates to ~1000 chars at a sentence boundary',
      'With --all: re-fetches every creature, not just low-quality ones',
      'Rate limited: 1s between Wikipedia requests',
    ],
    command: 'uv',
    args: ['run', 'python', 'scripts/enrich_descriptions.py'],
    cwd: PYTHON_DIR,
    dependsOn: ['scrape-pbdb'],
    userArgs: [
      {
        name: 'all',
        flag: '--all',
        type: 'boolean',
        description: 'Re-fetch ALL descriptions (default: only missing/low-quality)',
        default: false,
      },
    ],
    artifacts: [
      {
        path: 'python/data/creatures_enriched.json',
        description: 'Creature data with enriched descriptions',
      },
    ],
    estimatedDuration: '~5-10 min',
  },
  {
    id: 'clean-descriptions',
    name: 'Clean Descriptions',
    description:
      'Strip HTML tags, metadata junk, and truncated artifacts from descriptions',
    details: [
      'Removes everything after "Taxonomic details" or "Discover more" sections',
      'Strips complete and truncated HTML tags',
      'Collapses whitespace and removes trailing punctuation artifacts',
      'Safe to run multiple times — idempotent',
    ],
    command: 'uv',
    args: ['run', 'python', 'scripts/clean_descriptions.py'],
    cwd: PYTHON_DIR,
    dependsOn: ['enrich-descriptions'],
    userArgs: [],
    artifacts: [
      {
        path: 'python/data/creatures_enriched.json',
        description: 'Creature data with cleaned descriptions',
      },
    ],
    estimatedDuration: 'instant',
  },
  {
    id: 'download-images',
    name: 'Download Images',
    description:
      'Download creature images from Wikimedia Commons, convert to WebP (thumbnailed to fit 600x800, preserving aspect ratio)',
    details: [
      'Downloads from each creature\'s wikipediaImageUrl field',
      'Converts to RGB (handles RGBA by compositing onto white background)',
      'Thumbnails to fit within 600x800 using LANCZOS resampling — preserves aspect ratio, no cropping',
      'Saves as WebP at quality 85',
      'Skips already-downloaded images — safe to re-run',
      'Rate limited: 3s between downloads, exponential backoff on 429s (30s, 60s, 120s)',
      'May need multiple runs to get all images due to Wikimedia throttling',
    ],
    command: 'uv',
    args: ['run', 'python', 'scripts/download_images.py'],
    cwd: PYTHON_DIR,
    dependsOn: ['clean-descriptions'],
    userArgs: [
      {
        name: 'limit',
        flag: '',
        type: 'number',
        description: 'Limit to first N creatures',
      },
    ],
    artifacts: [
      {
        path: 'python/data/images',
        description: 'Downloaded WebP images',
        glob: 'python/data/images/*.webp',
      },
    ],
    estimatedDuration: '~20-40 min',
  },
  {
    id: 'compute-aspect-ratios',
    name: 'Compute Aspect Ratios',
    description:
      'Compute image aspect ratios from downloaded WebP files and update creature data',
    details: [
      'Opens each WebP in data/images/ and computes width/height ratio',
      'Writes imageAspectRatio field into creatures_enriched.json',
      'Used by the frontend to size card placeholders before images load',
      'Skips creatures with missing image files',
    ],
    command: 'uv',
    args: ['run', 'python', 'scripts/compute_aspect_ratios.py'],
    cwd: PYTHON_DIR,
    dependsOn: ['download-images'],
    userArgs: [],
    artifacts: [
      {
        path: 'python/data/creatures_enriched.json',
        description: 'Creature data with aspect ratios',
      },
    ],
    estimatedDuration: 'instant',
  },
  {
    id: 'upload-to-r2',
    name: 'Upload to R2',
    description:
      'Upload processed WebP images to Cloudflare R2 bucket, update imageUrl fields',
    details: [
      'Default is dry-run — previews what would be uploaded without actually doing it (still updates imageUrl in JSON)',
      'Pass --yolo to actually upload to R2',
      'Uploads to local bucket (paleo-waifu-images) by default, --remote for production (paleo-waifu-images-prod)',
      'Checks if each object already exists in R2 and skips — safe to re-run',
      '4 parallel upload workers via wrangler r2 object put',
      'Sets imageUrl to https://cdn.jacobmaynard.dev/creatures/{slug}.webp',
      'Requires wrangler to be authenticated (wrangler login)',
    ],
    command: 'uv',
    args: ['run', 'python', 'scripts/upload_to_r2.py'],
    cwd: PYTHON_DIR,
    dependsOn: ['compute-aspect-ratios'],
    userArgs: [
      {
        name: 'yolo',
        flag: '--yolo',
        type: 'boolean',
        description: 'Actually upload (default is dry-run preview)',
        default: false,
      },
      {
        name: 'remote',
        flag: '--remote',
        type: 'boolean',
        description: 'Upload to production R2 bucket (paleo-waifu-images-prod) instead of local',
        default: false,
      },
    ],
    artifacts: [
      {
        path: 'python/data/creatures_enriched.json',
        description: 'Creature data with imageUrl fields',
      },
    ],
    estimatedDuration: '~5 min',
  },
  {
    id: 'generate-seed',
    name: 'Generate Seed SQL',
    description:
      'Generate D1 INSERT statements from creature data for database seeding',
    details: [
      'Reads creatures_enriched.json and outputs seed.sql at project root',
      'Generates INSERT OR REPLACE for each creature (idempotent)',
      'Creates a default "Mesozoic Mayhem" banner containing all creatures',
      'Generates banner_pool entries linking creatures to the banner',
      'Uses deterministic IDs: SHA256 of scientific name, first 21 chars (consistent across re-runs)',
      'Prints rarity distribution summary',
    ],
    command: 'uv',
    args: ['run', 'python', 'scripts/generate_seed.py'],
    cwd: PYTHON_DIR,
    dependsOn: ['upload-to-r2'],
    userArgs: [],
    artifacts: [
      { path: 'seed.sql', description: 'D1 seed SQL file' },
    ],
    estimatedDuration: 'instant',
  },
  {
    id: 'clear-local-db',
    name: 'Clear Local DB',
    description:
      'Drop local D1 state and re-apply migrations. Does not affect production.',
    details: [
      'Runs: rm -rf .wrangler/state && pnpm db:migrate:local',
      'Completely wipes the local D1 database (all tables, all data)',
      'Re-applies all Drizzle migrations to recreate the schema',
      'Use before seeding if you want a clean slate',
      'Does NOT touch production — safe to run anytime',
    ],
    command: 'pnpm',
    args: ['db:clear:local'],
    cwd: PROJECT_ROOT,
    dependsOn: [],
    userArgs: [],
    artifacts: [],
    estimatedDuration: 'instant',
  },
  {
    id: 'seed-db',
    name: 'Seed Database',
    description: 'Execute seed.sql against D1 database (local or production)',
    details: [
      'Runs: wrangler d1 execute ... --file=./seed.sql',
      'Default targets local D1 (paleo-waifu-db via miniflare)',
      'With --remote: targets production D1 (paleo-waifu-db-prod)',
      'Uses INSERT OR REPLACE — safe to re-run (idempotent)',
      'No dry-run available — use Clear Local DB first if you want a fresh start',
    ],
    command: 'pnpm',
    args: ['db:seed:local'],
    cwd: PROJECT_ROOT,
    dependsOn: ['generate-seed'],
    userArgs: [
      {
        name: 'remote',
        flag: '--remote',
        type: 'boolean',
        description: 'Seed production database instead of local',
        default: false,
      },
    ],
    artifacts: [],
    estimatedDuration: 'instant',
  },
]

export function getStage(id: string): StageDefinition | undefined {
  return stages.find((s) => s.id === id)
}

export function getExecutionOrder(fromStage?: string): string[] {
  if (!fromStage) return stages.map((s) => s.id)

  const idx = stages.findIndex((s) => s.id === fromStage)
  if (idx === -1) return []
  return stages.slice(idx).map((s) => s.id)
}
