"""
Download creature images from Wikimedia URLs and process them for the game.

Reads creatures_enriched.json, downloads each creature's image,
resizes to a consistent size, converts to WebP, and saves locally.

Usage:
    uv run python scripts/download_images.py [limit]
"""

import json
import re
import sys
import time
from io import BytesIO
from pathlib import Path

import requests
from PIL import Image
from tqdm import tqdm

DATA_DIR = Path(__file__).parent.parent / "data"
IMAGES_DIR = DATA_DIR / "images"
USER_AGENT = "PaleoWaifuBot/1.0 (paleo-waifu gacha game; educational)"

# Target dimensions (3:4 aspect ratio to match frontend card display)
TARGET_WIDTH = 600
TARGET_HEIGHT = 800

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def download_with_retry(url: str, max_retries: int = 3) -> bytes:
    """Download with exponential backoff on 429s."""
    for attempt in range(max_retries):
        resp = SESSION.get(url, timeout=30)
        if resp.status_code == 429:
            wait = 30 * (2 ** attempt)  # 30s, 60s, 120s
            tqdm.write(f"  Rate limited, waiting {wait}s...")
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.content
    raise requests.HTTPError(f"Still rate-limited after {max_retries} retries")


def download_and_process(url: str, output_path: Path) -> bool:
    """Download an image, resize to target dimensions, save as WebP."""
    try:
        content = download_with_retry(url)

        img = Image.open(BytesIO(content))

        # Convert to RGB if necessary (handles RGBA, palette, etc.)
        if img.mode in ("RGBA", "LA"):
            # Paste onto white background
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Resize to fit within max dimensions, preserving aspect ratio (no crop)
        img.thumbnail((TARGET_WIDTH, TARGET_HEIGHT), Image.LANCZOS)

        # Save as WebP
        img.save(output_path, "WebP", quality=85)
        return True

    except Exception as e:
        tqdm.write(f"  Error: {e}")
        return False


def main():
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    creatures = json.loads((DATA_DIR / "creatures_enriched.json").read_text())

    limit = int(sys.argv[1]) if len(sys.argv) > 1 else len(creatures)
    creatures = creatures[:limit]

    stats = {"downloaded": 0, "skipped": 0, "failed": 0, "no_url": 0}

    for creature in tqdm(creatures, desc="Downloading images"):
        url = creature.get("wikipediaImageUrl")
        if not url:
            stats["no_url"] += 1
            continue

        slug = slugify(creature["scientificName"])
        output_path = IMAGES_DIR / f"{slug}.webp"

        # Skip if already downloaded
        if output_path.exists():
            stats["skipped"] += 1
            continue

        if download_and_process(url, output_path):
            stats["downloaded"] += 1
        else:
            stats["failed"] += 1
            tqdm.write(f"  Failed: {creature['name']} ({url[:60]}...)")

        time.sleep(3)  # Rate limit — Wikimedia enforces strict throttling

    print(f"\nDone!")
    print(f"  Downloaded: {stats['downloaded']}")
    print(f"  Skipped (exists): {stats['skipped']}")
    print(f"  Failed: {stats['failed']}")
    print(f"  No URL: {stats['no_url']}")
    print(f"  Total images: {len(list(IMAGES_DIR.glob('*.webp')))}")


if __name__ == "__main__":
    main()
