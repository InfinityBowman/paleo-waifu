#!/bin/bash
# Sets up local D1 with fresh data from production.
#
# Pulls creatures, banners, and banner_pool from prod D1,
# then seeds battle stats/abilities and dev users.
#
# Usage: pnpm db:setup:local
set -e

cd "$(dirname "$0")/.."

PROD_DB="paleo-waifu-db-prod"
LOCAL_DB="paleo-waifu-db"

if [ -z "$CLOUDFLARE_ACCOUNT_ID" ] && [ -f .env.production ]; then
  export CLOUDFLARE_ACCOUNT_ID=$(grep CLOUDFLARE_ACCOUNT_ID .env.production | cut -d= -f2)
fi
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

pull_table() {
  local table=$1
  echo "  $table..."
  wrangler d1 execute "$PROD_DB" --remote --env production \
    --command "SELECT * FROM $table" --json > "$TMP_DIR/${table}.json"
  node -e "
const data = JSON.parse(require('fs').readFileSync('$TMP_DIR/${table}.json', 'utf8'));
// wrangler --json format: array of result objects, or object with error
const results = Array.isArray(data) ? data[0].results : (data.result || data.results || []);
if (!results || !results.length) { console.error('  (empty table)'); process.exit(0); }
for (const r of results) {
  const cols = Object.keys(r);
  const vals = cols.map(c => {
    if (r[c] === null) return 'NULL';
    if (typeof r[c] === 'number') return r[c];
    return \"'\" + String(r[c]).replace(/'/g, \"''\") + \"'\";
  });
  console.log('INSERT OR REPLACE INTO $table (' + cols.join(', ') + ') VALUES (' + vals.join(', ') + ');');
}
console.error('  ' + results.length + ' rows');
" > "$TMP_DIR/${table}.sql"
  wrangler d1 execute "$LOCAL_DB" --local --file="$TMP_DIR/${table}.sql"
}

echo "[1/4] Clearing local D1 and applying migrations..."
rm -rf .wrangler/state
wrangler d1 migrations apply "$LOCAL_DB" --local

echo "[2/4] Pulling data from production..."
pull_table creature
pull_table banner
pull_table banner_pool

echo "[3/4] Seeding battle stats and abilities..."
wrangler d1 execute "$LOCAL_DB" --local --file=./battle_seed.sql

echo "[4/4] Seeding dev users..."
wrangler d1 execute "$LOCAL_DB" --local --file=./seed-dev-users.sql

echo "Done! Local D1 is ready."
