"""
Upload creature images to Cloudflare R2 and update creatures_enriched.json
with the final public image URLs.

Prerequisites:
    - wrangler must be authenticated (wrangler login)
    - R2 bucket must exist (wrangler r2 bucket create paleo-waifu-images)
    - Images must be downloaded to data/images/

Usage:
    uv run python scripts/upload_to_r2.py [--dry-run] [--bucket BUCKET] [--domain DOMAIN]
"""

import json
import re
import subprocess
import sys
from pathlib import Path

from tqdm import tqdm

DATA_DIR = Path(__file__).parent.parent / "data"
IMAGES_DIR = DATA_DIR / "images"
PROJECT_ROOT = Path(__file__).parent.parent.parent

DEFAULT_BUCKET = "paleo-waifu-images"


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def upload_to_r2(local_path: Path, key: str, bucket: str) -> bool:
    """Upload a file to R2 using wrangler CLI."""
    cmd = [
        "npx", "wrangler", "r2", "object", "put",
        f"{bucket}/{key}",
        f"--file={local_path}",
        "--content-type=image/webp",
    ]
    result = subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def main():
    dry_run = "--dry-run" in sys.argv
    bucket = DEFAULT_BUCKET
    domain = None

    # Parse args
    for i, arg in enumerate(sys.argv):
        if arg == "--bucket" and i + 1 < len(sys.argv):
            bucket = sys.argv[i + 1]
        if arg == "--domain" and i + 1 < len(sys.argv):
            domain = sys.argv[i + 1]

    if not domain:
        print("Usage: upload_to_r2.py --domain <your-r2-public-domain>")
        print("  e.g. --domain images.paleo-waifu.example.com")
        print("  or   --domain pub-xxxx.r2.dev")
        print()
        print("Set up public access for R2 bucket first:")
        print(f"  wrangler r2 bucket create {bucket}")
        print("  Then enable public access in Cloudflare dashboard")
        if not dry_run:
            sys.exit(1)
        domain = "EXAMPLE.r2.dev"

    creatures = json.loads((DATA_DIR / "creatures_enriched.json").read_text())

    stats = {"uploaded": 0, "missing": 0, "failed": 0}
    updated = 0

    for creature in tqdm(creatures, desc="Uploading to R2"):
        slug = slugify(creature["scientificName"])
        local_path = IMAGES_DIR / f"{slug}.webp"

        if not local_path.exists():
            stats["missing"] += 1
            continue

        key = f"creatures/{slug}.webp"
        public_url = f"https://{domain}/{key}"

        if dry_run:
            tqdm.write(f"  [DRY RUN] {local_path.name} -> {key}")
            creature["imageUrl"] = public_url
            updated += 1
            continue

        if upload_to_r2(local_path, key, bucket):
            creature["imageUrl"] = public_url
            stats["uploaded"] += 1
            updated += 1
        else:
            stats["failed"] += 1
            tqdm.write(f"  FAIL: {creature['name']}")

    # Write back
    (DATA_DIR / "creatures_enriched.json").write_text(json.dumps(creatures, indent=2))

    print(f"\nDone! {'(DRY RUN)' if dry_run else ''}")
    print(f"  Uploaded: {stats['uploaded']}")
    print(f"  Missing images: {stats['missing']}")
    print(f"  Failed: {stats['failed']}")
    print(f"  URLs updated: {updated}")


if __name__ == "__main__":
    main()
