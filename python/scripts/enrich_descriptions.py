"""Backfill missing or low-quality creature descriptions from Wikipedia.

Queries Wikipedia's API with explaintext=True for clean plaintext extracts.
Targets creatures with empty, too-short, or junk descriptions (e.g. just a
country name from the NHM scraper). Also cleans up pronunciation noise from
all descriptions.

Usage:
    uv run python scripts/enrich_descriptions.py [--all]

    --all    Re-fetch descriptions for ALL creatures, not just low-quality ones
"""

import json
import re
import sys
import time
from pathlib import Path

import requests
from tqdm import tqdm

DATA_DIR = Path(__file__).parent.parent / "data"
CACHE_DIR = DATA_DIR / "cache"
WIKI_API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "PaleoWaifuBot/1.0 (paleo-waifu gacha game; educational)"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})

# Minimum length for a description to be considered "good enough"
MIN_QUALITY_LEN = 100


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def is_low_quality(desc: str) -> bool:
    """Check if a description is too short, just a location, or junk."""
    if not desc or len(desc) < MIN_QUALITY_LEN:
        return True
    return False


def clean_pronunciation(text: str) -> str:
    """Strip pronunciation guides like ( ə-KIL-ə-BAY-tor; meaning '...') from text."""
    # Match parenthetical blocks at the start that contain IPA or pronunciation
    # e.g. "Achillobator ( ə-KIL-ə-BAY-tor; meaning "Achilles hero") is a genus..."
    # Also handles (; "meaning") and ( /.../) patterns
    text = re.sub(
        r'\s*\([^)]*(?:'
        r'[/ˈˌəɪʊɒæɛɔʌɑðθʃʒŋ]'  # IPA characters
        r'|[A-Z]{2,}-'  # CAPS-WITH-DASHES pronunciation
        r'|pronounced'
        r'|lit\.\s'  # lit. 'meaning'
        r')[^)]*\)',
        '',
        text,
    )
    # Clean up double spaces left behind
    text = re.sub(r'  +', ' ', text)
    # Fix cases like "Name  is a" -> "Name is a"
    return text.strip()


def clean_description(text: str) -> str:
    """Apply all cleaning passes to a description."""
    text = clean_pronunciation(text)
    # Strip trailing incomplete sentences (no period at end)
    if text and text[-1] not in '.!?")\u2019':
        last_period = text.rfind('. ')
        if last_period > len(text) // 2:
            text = text[: last_period + 1]
    return text.strip()


def fetch_wikipedia_extract(title: str) -> str | None:
    """Fetch the intro extract from Wikipedia as clean plaintext."""
    cache_key = f"wiki-desc-{slugify(title)}"
    cache_file = CACHE_DIR / f"{cache_key}.json"

    if cache_file.exists():
        data = json.loads(cache_file.read_text())
    else:
        params = {
            "action": "query",
            "titles": title,
            "prop": "extracts",
            "exintro": True,
            "explaintext": True,
            "redirects": 1,
            "format": "json",
        }
        resp = SESSION.get(WIKI_API, params=params)
        resp.raise_for_status()
        data = resp.json()
        cache_file.write_text(json.dumps(data, indent=2))
        time.sleep(1)  # rate limit

    pages = data.get("query", {}).get("pages", {})
    if not pages:
        return None

    page = next(iter(pages.values()))
    if page.get("missing") is not None:
        return None

    extract = page.get("extract", "").strip()
    if not extract:
        return None

    # Take first 1000 chars, ending at a sentence boundary
    if len(extract) > 1000:
        cut = extract[:1000].rfind(". ")
        if cut > 400:
            extract = extract[: cut + 1]
        else:
            extract = extract[:1000].rstrip()

    return extract


def main():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    enrich_all = "--all" in sys.argv

    path = DATA_DIR / "creatures_enriched.json"
    creatures = json.loads(path.read_text())
    print(f"Loaded {len(creatures)} creatures")

    if enrich_all:
        targets = creatures
        print(f"Re-fetching descriptions for ALL {len(targets)} creatures")
    else:
        targets = [c for c in creatures if is_low_quality(c.get("description", ""))]
        print(f"Found {len(targets)} creatures with missing/low-quality descriptions")

    fetched = 0
    not_found = []

    for creature in tqdm(targets, desc="Fetching Wikipedia"):
        sci_name = creature["scientificName"]
        genus = sci_name.split()[0]

        # Try scientific name first, then genus, then common name
        extract = fetch_wikipedia_extract(sci_name)
        if not extract:
            extract = fetch_wikipedia_extract(genus)
        if not extract:
            extract = fetch_wikipedia_extract(creature["name"])

        if extract:
            creature["description"] = extract
            fetched += 1
        else:
            not_found.append(creature["name"])
            tqdm.write(f"  No Wikipedia article: {creature['name']} ({sci_name})")

    # Clean ALL descriptions (pronunciation, trailing junk, etc.)
    cleaned = 0
    for creature in creatures:
        desc = creature.get("description", "")
        if desc:
            result = clean_description(desc)
            if result != desc:
                creature["description"] = result
                cleaned += 1

    path.write_text(json.dumps(creatures, indent=2))

    has_desc = sum(1 for c in creatures if c.get("description"))
    still_short = sum(1 for c in creatures if is_low_quality(c.get("description", "")))
    print(f"\nFetched {fetched} from Wikipedia, cleaned {cleaned} descriptions")
    print(f"Creatures with descriptions: {has_desc}/{len(creatures)}")
    print(f"Still low-quality (<{MIN_QUALITY_LEN} chars): {still_short}")

    if not_found:
        print(f"\nNo Wikipedia article found ({len(not_found)}):")
        for name in not_found:
            print(f"  - {name}")


if __name__ == "__main__":
    main()
