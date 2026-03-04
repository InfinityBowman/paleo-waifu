"""Backfill D1 fields that were never written by generate_seed.py.

The original seed script only wrote 13 of 19 creature fields. This script
reads creatures_enriched.json and UPDATEs the missing fields:
  source, type, found_in, name_meaning, pronunciation, wikipedia_image_url

Dry run by default — prints what would change. Use --commit to apply.

Usage:
    uv run python scripts/backfill_from_json.py           # dry run
    uv run python scripts/backfill_from_json.py --commit   # apply changes
"""

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

from tqdm import tqdm

from d1_client import D1Client

DATA_DIR = Path(__file__).parent.parent / "data"

# Fields in the JSON that were never seeded to D1
BACKFILL_FIELDS = {
    "source": "source",
    "type": "type",
    "foundIn": "found_in",
    "nameMeaning": "name_meaning",
    "pronunciation": "pronunciation",
    "wikipediaImageUrl": "wikipedia_image_url",
}


def nanoid(name: str) -> str:
    """Deterministic short ID from name (matches generate_seed.py)."""
    return hashlib.sha256(name.encode()).hexdigest()[:21]


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill un-seeded fields from creatures_enriched.json")
    parser.add_argument("--commit", action="store_true", help="Apply changes to prod D1 (default: dry run)")
    args = parser.parse_args()

    json_path = DATA_DIR / "creatures_enriched.json"
    if not json_path.exists():
        print(f"Error: {json_path} not found")
        return

    creatures = json.loads(json_path.read_text())
    print(f"Loaded {len(creatures)} creatures from {json_path.name}")

    db = D1Client()

    # Build lookup of current DB state
    db_creatures = db.query(
        "SELECT id, source, type, found_in, name_meaning, pronunciation, wikipedia_image_url FROM creature"
    )
    db_lookup = {row["id"]: row for row in db_creatures}
    print(f"Found {len(db_lookup)} creatures in D1")

    updates: list[dict] = []

    for c in creatures:
        cid = nanoid(c["scientificName"])
        db_row = db_lookup.get(cid)
        if not db_row:
            continue

        changes: dict = {}
        for json_key, db_col in BACKFILL_FIELDS.items():
            json_val = c.get(json_key)
            db_val = db_row.get(db_col)
            # Only fill NULL DB fields with non-empty JSON values
            if db_val is None and json_val:
                changes[db_col] = json_val

        if changes:
            updates.append({
                "id": cid,
                "name": c["name"],
                "changes": changes,
            })

    # ─── Report ────────────────────────────────────────────────────────

    if not updates:
        print("\nNo fields to backfill — everything is already populated.")
        return

    field_counts: Counter = Counter()
    for u in updates:
        for field in u["changes"]:
            field_counts[field] += 1

    print(f"\n{'=' * 90}")
    print(f"{'DRY RUN — ' if not args.commit else ''}Found {len(updates)} creatures to update:")
    print(f"{'=' * 90}")

    # Summary by field
    for field, count in field_counts.most_common():
        print(f"  {field:<25} {count} creatures")

    print(f"\nTotal updates: {sum(field_counts.values())} field writes across {len(updates)} creatures")

    # Show first 20 as sample
    print(f"\nSample (first 20):")
    print(f"{'Name':<30} {'Field':<22} {'Value'}")
    print(f"{'-' * 30} {'-' * 22} {'-' * 30}")
    shown = 0
    for u in updates[:20]:
        for field, value in u["changes"].items():
            display_val = str(value)[:40]
            print(f"{u['name']:<30} {field:<22} {display_val}")
            shown += 1

    if len(updates) > 20:
        remaining = sum(len(u["changes"]) for u in updates[20:])
        print(f"  ... and {remaining} more field writes")

    if not args.commit:
        print("\nDry run complete. Use --commit to apply these changes.")
        return

    # ─── Apply ─────────────────────────────────────────────────────────

    print("\nApplying updates to prod D1...")
    applied = 0
    for u in tqdm(updates, desc="Updating D1"):
        set_clauses = []
        values = []
        for field, value in u["changes"].items():
            set_clauses.append(f"{field} = ?")
            values.append(value)
        values.append(u["id"])

        sql = f"UPDATE creature SET {', '.join(set_clauses)} WHERE id = ?"
        db.execute(sql, values)
        applied += 1

    print(f"\nDone! Updated {applied} creatures.")


if __name__ == "__main__":
    main()
