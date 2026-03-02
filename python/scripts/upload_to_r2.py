"""
Upload creature images to Cloudflare R2 and update creatures_enriched.json
with Worker-served image URLs (/api/images/creatures/{slug}.webp).

Prerequisites:
    - wrangler must be authenticated (wrangler login)
    - R2 bucket must exist (wrangler r2 bucket create paleo-waifu-images)
    - Images must be downloaded to data/images/

Usage:
    uv run python scripts/upload_to_r2.py [--remote] [--bucket BUCKET]   # dry run (default)
    uv run python scripts/upload_to_r2.py --yolo [--remote]              # actually upload
"""

import json
import re
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from tqdm import tqdm

DATA_DIR = Path(__file__).parent.parent / "data"
IMAGES_DIR = DATA_DIR / "images"
PROJECT_ROOT = Path(__file__).parent.parent.parent

DEFAULT_BUCKET = "paleo-waifu-images"
PROD_BUCKET = "paleo-waifu-images-prod"
WORKERS = 4


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def check_exists(key: str, bucket: str, remote: bool = False) -> bool:
    """Check if an object already exists in R2."""
    cmd = [
        "npx", "wrangler", "r2", "object", "get",
        f"{bucket}/{key}",
        "--file=/dev/null",
    ]
    if remote:
        cmd.append("--remote")
    result = subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def upload_to_r2(local_path: Path, key: str, bucket: str, remote: bool = False) -> bool:
    """Upload a file to R2 using wrangler CLI."""
    cmd = [
        "npx", "wrangler", "r2", "object", "put",
        f"{bucket}/{key}",
        f"--file={local_path}",
        "--content-type=image/webp",
    ]
    if remote:
        cmd.append("--remote")
    result = subprocess.run(
        cmd,
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    return result.returncode == 0


def main():
    dry_run = "--yolo" not in sys.argv
    remote = "--remote" in sys.argv
    bucket = PROD_BUCKET if remote else DEFAULT_BUCKET

    # Parse args
    for i, arg in enumerate(sys.argv):
        if arg == "--bucket" and i + 1 < len(sys.argv):
            bucket = sys.argv[i + 1]

    creatures = json.loads((DATA_DIR / "creatures_enriched.json").read_text())

    # Build upload tasks
    tasks = []
    for creature in creatures:
        slug = slugify(creature["scientificName"])
        local_path = IMAGES_DIR / f"{slug}.webp"
        if not local_path.exists():
            creature["_status"] = "missing"
            continue
        key = f"creatures/{slug}.webp"
        creature["imageUrl"] = f"https://cdn.jacobmaynard.dev/{key}"
        creature["_status"] = "pending"
        tasks.append((creature, local_path, key))

    if dry_run:
        for creature, local_path, key in tasks:
            creature["_status"] = "uploaded"
        missing = sum(1 for c in creatures if c.get("_status") == "missing")
        print(f"[DRY RUN] Would upload {len(tasks)} images ({missing} missing)")
    else:
        # Parallel uploads
        def do_upload(item):
            creature, local_path, key = item
            if check_exists(key, bucket, remote=remote):
                return item, True, True
            ok = upload_to_r2(local_path, key, bucket, remote=remote)
            return item, ok, False

        skipped = 0
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = {pool.submit(do_upload, t): t for t in tasks}
            with tqdm(total=len(futures), desc="Uploading to R2") as pbar:
                for future in as_completed(futures):
                    (creature, local_path, key), ok, was_skipped = future.result()
                    if was_skipped:
                        creature["_status"] = "uploaded"
                        skipped += 1
                    else:
                        creature["_status"] = "uploaded" if ok else "failed"
                        if not ok:
                            tqdm.write(f"  FAIL: {creature['name']}")
                    pbar.update(1)

    # Clean up temp status and write back
    stats = {"uploaded": 0, "missing": 0, "failed": 0}
    for c in creatures:
        status = c.pop("_status", None)
        if status == "uploaded":
            stats["uploaded"] += 1
        elif status == "missing":
            stats["missing"] += 1
        elif status == "failed":
            stats["failed"] += 1

    (DATA_DIR / "creatures_enriched.json").write_text(json.dumps(creatures, indent=2))

    print(f"\nDone! {'(DRY RUN)' if dry_run else ''}")
    print(f"  Uploaded: {stats['uploaded']}")
    if not dry_run:
        print(f"  Skipped (already exists): {skipped}")
    print(f"  Missing images: {stats['missing']}")
    print(f"  Failed: {stats['failed']}")


if __name__ == "__main__":
    main()
