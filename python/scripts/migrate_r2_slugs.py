"""
One-time migration: rename R2 image keys from scientificName-based slugs
to common name-based slugs, and update imageUrl in D1.

This makes R2 keys consistent with the DB slug column (which uses common names).

Prerequisites:
    - wrangler must be authenticated
    - Env vars: CF_ACCOUNT_ID, CF_D1_DATABASE_ID, CF_API_TOKEN

Usage:
    uv run python scripts/migrate_r2_slugs.py              # dry run
    uv run python scripts/migrate_r2_slugs.py --yolo        # actually migrate
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

import requests

PROJECT_ROOT = Path(__file__).parent.parent.parent
BUCKET = "paleo-waifu-images-prod"

CF_API = "https://api.cloudflare.com/client/v4"


def slugify(name: str) -> str:
    s = re.sub(r"[''`]", "", name.lower())
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def d1_query(sql: str, params: list | None = None) -> list[dict]:
    account_id = os.environ["CF_ACCOUNT_ID"]
    db_id = os.environ["CF_D1_DATABASE_ID"]
    token = os.environ["CF_API_TOKEN"]

    url = f"{CF_API}/accounts/{account_id}/d1/database/{db_id}/query"
    body = {"sql": sql}
    if params:
        body["params"] = params

    resp = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json=body,
    )
    resp.raise_for_status()
    data = resp.json()
    if not data["success"]:
        raise RuntimeError(f"D1 error: {data['errors']}")
    return data["result"][0]["results"]


def r2_copy(old_key: str, new_key: str) -> bool:
    """Copy an R2 object to a new key using wrangler."""
    # Download to temp file
    import tempfile
    with tempfile.NamedTemporaryFile(suffix=".webp", delete=False) as tmp:
        tmp_path = tmp.name

    try:
        # Get old object
        result = subprocess.run(
            ["npx", "wrangler", "r2", "object", "get", f"{BUCKET}/{old_key}",
             f"--file={tmp_path}", "--remote"],
            cwd=PROJECT_ROOT, capture_output=True, text=True,
        )
        if result.returncode != 0:
            return False

        # Put with new key
        result = subprocess.run(
            ["npx", "wrangler", "r2", "object", "put", f"{BUCKET}/{new_key}",
             f"--file={tmp_path}", "--content-type=image/webp",
             "--cache-control=public, max-age=31536000, immutable", "--remote"],
            cwd=PROJECT_ROOT, capture_output=True, text=True,
        )
        return result.returncode == 0
    finally:
        os.unlink(tmp_path)


def r2_delete(key: str) -> bool:
    result = subprocess.run(
        ["npx", "wrangler", "r2", "object", "delete", f"{BUCKET}/{key}", "--remote"],
        cwd=PROJECT_ROOT, capture_output=True, text=True,
    )
    return result.returncode == 0


def main():
    dry_run = "--yolo" not in sys.argv

    # Get all creatures with their current imageUrl
    rows = d1_query("SELECT id, name, scientific_name, slug, image_url FROM creature")

    migrations = []
    for row in rows:
        image_url = row.get("image_url")
        if not image_url:
            continue

        name = row["name"]
        sci_name = row["scientific_name"]
        db_slug = row["slug"]

        # Current R2 key (from imageUrl)
        # imageUrl format: /api/images/creatures/{old_slug}.webp
        if not image_url.startswith("/api/images/creatures/"):
            continue
        old_r2_slug = image_url.replace("/api/images/creatures/", "").replace(".webp", "")

        # Target slug (from common name, matching DB convention)
        new_slug = db_slug or slugify(name)
        new_r2_key = f"creatures/{new_slug}.webp"
        old_r2_key = f"creatures/{old_r2_slug}.webp"
        new_image_url = f"/api/images/{new_r2_key}"

        if old_r2_key == new_r2_key:
            continue  # Already correct

        migrations.append({
            "id": row["id"],
            "name": name,
            "old_key": old_r2_key,
            "new_key": new_r2_key,
            "new_image_url": new_image_url,
        })

    print(f"Found {len(migrations)} R2 keys to migrate")
    if not migrations:
        print("Nothing to do.")
        return

    for m in migrations[:10]:
        print(f"  {m['name']}: {m['old_key']} -> {m['new_key']}")
    if len(migrations) > 10:
        print(f"  ... and {len(migrations) - 10} more")

    if dry_run:
        print("\n[DRY RUN] No changes made. Run with --yolo to apply.")
        return

    # Execute migrations
    succeeded = 0
    failed = 0
    for m in migrations:
        print(f"  Migrating {m['name']}...", end=" ", flush=True)

        # Copy R2 object to new key
        if not r2_copy(m["old_key"], m["new_key"]):
            print("FAILED (copy)")
            failed += 1
            continue

        # Update D1 imageUrl
        d1_query(
            "UPDATE creature SET image_url = ? WHERE id = ?",
            [m["new_image_url"], m["id"]],
        )

        # Delete old R2 object
        r2_delete(m["old_key"])

        print("OK")
        succeeded += 1

    print(f"\nDone! Migrated: {succeeded}, Failed: {failed}")


if __name__ == "__main__":
    main()
