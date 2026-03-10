/**
 * Backfill slug column for all creatures.
 *
 * Usage:
 *   npx wrangler d1 execute paleo-waifu-db --local --file tools/backfill-slugs.sql
 *
 * This script generates the SQL file, then you run it with wrangler.
 * Run with: npx tsx tools/backfill-slugs.ts [--remote]
 */
import { execSync } from 'child_process'

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const isRemote = process.argv.includes('--remote')
const flag = isRemote ? '--remote' : '--local'

// Fetch all creatures without slugs
const result = execSync(
  `npx wrangler d1 execute paleo-waifu-db ${flag} --json --command "SELECT id, name FROM creature WHERE slug IS NULL"`,
  { encoding: 'utf-8', cwd: process.cwd() + '/web' },
)

const parsed = JSON.parse(result)
const rows = parsed[0]?.results as Array<{ id: string; name: string }>

if (!rows || rows.length === 0) {
  console.log('No creatures need slug backfill.')
  process.exit(0)
}

// Check for collisions
const slugMap = new Map<string, string>()
for (const row of rows) {
  const slug = toSlug(row.name)
  if (slugMap.has(slug)) {
    console.error(
      `COLLISION: "${row.name}" and "${slugMap.get(slug)}" both produce slug "${slug}"`,
    )
    process.exit(1)
  }
  slugMap.set(slug, row.name)
}

console.log(`Backfilling ${rows.length} creatures ${flag}...`)

// Build and execute UPDATE statements in batches
const BATCH_SIZE = 50
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE)
  const sql = batch
    .map((r) => `UPDATE creature SET slug = '${toSlug(r.name)}' WHERE id = '${r.id}';`)
    .join('\n')

  execSync(
    `npx wrangler d1 execute paleo-waifu-db ${flag} --command "${sql.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8', cwd: process.cwd() + '/web', stdio: 'inherit' },
  )
}

console.log(`Done. Backfilled ${rows.length} creatures.`)
