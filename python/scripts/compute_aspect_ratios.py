"""Compute image aspect ratios and write them into creatures_enriched.json."""

import json
import re
from pathlib import Path

from PIL import Image

DATA_DIR = Path(__file__).parent.parent / "data"
IMAGES_DIR = DATA_DIR / "images"


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main():
    enriched_path = DATA_DIR / "creatures_enriched.json"
    creatures = json.loads(enriched_path.read_text())

    updated = 0
    missing = 0

    for creature in creatures:
        slug = slugify(creature["scientificName"])
        img_path = IMAGES_DIR / f"{slug}.webp"

        if not img_path.exists():
            missing += 1
            continue

        with Image.open(img_path) as img:
            w, h = img.size
            creature["imageAspectRatio"] = round(w / h, 4)
            updated += 1

    enriched_path.write_text(json.dumps(creatures, indent=2, ensure_ascii=False) + "\n")

    print(f"Updated {updated} creatures with aspect ratios")
    if missing:
        print(f"Missing images for {missing} creatures")


if __name__ == "__main__":
    main()
