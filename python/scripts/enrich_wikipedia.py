"""Enrich creatures with size and weight data from Wikipedia.

Queries prod D1 for creatures missing size_meters or weight_kg, fetches
their Wikipedia articles, and parses measurements from the text.

Dry run by default — prints what would change. Use --commit to apply.

Usage:
    uv run python scripts/enrich_wikipedia.py                  # dry run (all sources)
    uv run python scripts/enrich_wikipedia.py --source pbdb    # only PBDB creatures
    uv run python scripts/enrich_wikipedia.py --commit          # apply changes
"""

import argparse
import json
import random
import re
import sys
import time
from pathlib import Path

import requests
from tqdm import tqdm

from d1_client import D1Client

DATA_DIR = Path(__file__).parent.parent / "data"
CACHE_DIR = DATA_DIR / "cache" / "wiki-enrich"

WIKI_API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "PaleoWaifuBot/1.0 (https://github.com/infinitybowman/paleo-waifu; jacobamaynard@proton.me)"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})


# ─── Wikipedia Fetching ────────────────────────────────────────────────


def fetch_wikipedia_extract(title: str) -> str | None:
    """Fetch the intro extract for a Wikipedia article.

    Tries the full title first, then just the genus name.
    Uses filesystem caching and respects rate limits with
    exponential backoff, jitter, and Retry-After headers.
    """
    for attempt_title in _title_variants(title):
        slug = re.sub(r"[^a-z0-9]+", "-", attempt_title.lower()).strip("-")
        cache_file = CACHE_DIR / f"{slug}.json"

        if cache_file.exists():
            data = json.loads(cache_file.read_text())
        else:
            data = _wiki_api_get(attempt_title)
            if data is not None:
                cache_file.write_text(json.dumps(data, indent=2))

        if data is None:
            continue

        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            if page.get("missing") is not None:
                continue
            extract = page.get("extract", "").strip()
            if extract and len(extract) > 50:
                return extract

    return None


def _title_variants(title: str) -> list[str]:
    """Generate search variants: full name, genus only."""
    variants = [title]
    genus = title.split()[0]
    if genus != title:
        variants.append(genus)
    return variants


def _wiki_api_get(title: str, max_retries: int = 5) -> dict | None:
    """GET from Wikipedia API with exponential backoff and Retry-After support."""
    params = {
        "action": "query",
        "titles": title,
        "prop": "extracts",
        "exintro": True,
        "explaintext": True,
        "redirects": 1,
        "format": "json",
    }

    for attempt in range(max_retries):
        try:
            resp = SESSION.get(WIKI_API, params=params, timeout=30)

            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", 30))
                wait = max(retry_after, 10) + (10 * attempt) + random.uniform(1, 5)
                tqdm.write(f"  Rate limited, waiting {wait:.0f}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait)
                continue

            if resp.status_code >= 500:
                wait = 10 * (2 ** attempt) + random.uniform(1, 5)
                tqdm.write(f"  Server error {resp.status_code}, retrying in {wait:.0f}s...")
                time.sleep(wait)
                continue

            resp.raise_for_status()

            # Polite delay between successful requests: 1-2s jitter
            time.sleep(1 + random.uniform(0, 1))
            return resp.json()

        except (requests.ConnectionError, requests.Timeout) as e:
            if attempt == max_retries - 1:
                tqdm.write(f"  Failed after {max_retries} retries: {e.__class__.__name__}")
                return None
            wait = 5 * (2 ** attempt) + random.uniform(1, 5)
            tqdm.write(f"  Connection error, retrying in {wait:.0f}s... ({e.__class__.__name__})")
            time.sleep(wait)

    tqdm.write(f"  Exhausted retries for {title}")
    return None


# ─── Parsing ───────────────────────────────────────────────────────────


def parse_measurements(text: str) -> dict:
    """Extract size (meters) and weight (kg) from Wikipedia text.

    Handles meters, feet, kg, tonnes, and range expressions ("5 to 7 metres").
    """
    result: dict = {}

    # Size in meters (e.g. "6 metres long", "5 to 7 meters in length")
    m = re.search(
        r"(\d+\.?\d*)\s*(?:to\s*(\d+\.?\d*)\s*)?m(?:eters?|etres?)?\s*(?:long|in length)",
        text, re.I,
    )
    if m:
        result["sizeMeters"] = round(
            (float(m.group(1)) + float(m.group(2))) / 2 if m.group(2) else float(m.group(1)),
            1,
        )
    else:
        # Try centimeters (for small creatures)
        m = re.search(
            r"(\d+\.?\d*)\s*(?:to\s*(\d+\.?\d*)\s*)?(?:cm|centim(?:eters?|etres?))\s*(?:long|in length)?",
            text, re.I,
        )
        if m:
            val = (float(m.group(1)) + float(m.group(2))) / 2 if m.group(2) else float(m.group(1))
            result["sizeMeters"] = round(val / 100, 2)
        else:
            # Feet
            m = re.search(
                r"(\d+\.?\d*)\s*(?:to\s*(\d+\.?\d*)\s*)?(?:ft|feet)\s*(?:long|in length)?",
                text, re.I,
            )
            if m:
                val = (float(m.group(1)) + float(m.group(2))) / 2 if m.group(2) else float(m.group(1))
                result["sizeMeters"] = round(val * 0.3048, 1)

    # Weight in kg
    m = re.search(
        r"(\d+[,.]?\d*)\s*(?:to\s*(\d+[,.]?\d*)\s*)?(?:kg|kilograms?)",
        text, re.I,
    )
    if m:
        w = float(m.group(1).replace(",", ""))
        if m.group(2):
            w = (w + float(m.group(2).replace(",", ""))) / 2
        result["weightKg"] = round(w)
    else:
        # Tonnes
        m = re.search(
            r"(\d+\.?\d*)\s*(?:to\s*(\d+\.?\d*)\s*)?(?:t(?:onnes?)?|metric tons?)\b",
            text, re.I,
        )
        if m:
            w = float(m.group(1)) * 1000
            if m.group(2):
                w = (w + float(m.group(2)) * 1000) / 2
            result["weightKg"] = round(w)
        else:
            # Pounds
            m = re.search(
                r"(\d+[,.]?\d*)\s*(?:to\s*(\d+[,.]?\d*)\s*)?(?:lb|lbs|pounds?)",
                text, re.I,
            )
            if m:
                w = float(m.group(1).replace(",", "")) * 0.453592
                if m.group(2):
                    w = (w + float(m.group(2).replace(",", "")) * 0.453592) / 2
                result["weightKg"] = round(w)

    return result


# ─── Main ──────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich creatures with Wikipedia size/weight data")
    parser.add_argument("--commit", action="store_true", help="Apply changes to prod D1 (default: dry run)")
    parser.add_argument("--source", choices=["pbdb", "wikipedia", "nhm", "all"], default="all",
                        help="Filter by creature source (default: all)")
    parser.add_argument("--limit", type=int, default=0, help="Max creatures to process (0 = all)")
    args = parser.parse_args()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    db = D1Client()

    # Find creatures missing size or weight
    where_clauses = ["(size_meters IS NULL OR weight_kg IS NULL)"]
    params: list = []
    if args.source != "all":
        where_clauses.append("source = ?")
        params.append(args.source)

    sql = f"SELECT id, name, scientific_name, size_meters, weight_kg, source FROM creature WHERE {' AND '.join(where_clauses)} ORDER BY name"
    creatures = db.query(sql, params)

    print(f"Found {len(creatures)} creatures with missing size/weight data")
    if args.source != "all":
        print(f"  (filtered to source={args.source})")

    if args.limit:
        creatures = creatures[:args.limit]
        print(f"  (limited to {args.limit})")

    updates: list[dict] = []

    for creature in tqdm(creatures, desc="Fetching Wikipedia"):
        sci_name = creature["scientific_name"]
        extract = fetch_wikipedia_extract(sci_name)
        if not extract:
            continue

        measurements = parse_measurements(extract)
        if not measurements:
            continue

        changes: dict = {}

        # Only fill in NULL fields — never overwrite existing data
        if creature["size_meters"] is None and "sizeMeters" in measurements:
            changes["size_meters"] = measurements["sizeMeters"]
        if creature["weight_kg"] is None and "weightKg" in measurements:
            changes["weight_kg"] = measurements["weightKg"]

        if changes:
            updates.append({
                "id": creature["id"],
                "name": creature["name"],
                "scientific_name": sci_name,
                "source": creature["source"],
                "changes": changes,
            })

    # ─── Report ────────────────────────────────────────────────────────

    if not updates:
        print("\nNo new data found.")
        return

    print(f"\n{'=' * 80}")
    print(f"{'DRY RUN — ' if not args.commit else ''}Found {len(updates)} creatures to update:")
    print(f"{'=' * 80}")
    print(f"{'Name':<35} {'Field':<14} {'New Value':<12} {'Source'}")
    print(f"{'-' * 35} {'-' * 14} {'-' * 12} {'-' * 10}")

    size_count = 0
    weight_count = 0
    for u in updates:
        for field, value in u["changes"].items():
            label = "size_meters" if field == "size_meters" else "weight_kg"
            if field == "size_meters":
                size_count += 1
            else:
                weight_count += 1
            print(f"{u['name']:<35} {label:<14} {value:<12} {u['source']}")

    print(f"\nSummary: {size_count} size_meters, {weight_count} weight_kg updates")

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
