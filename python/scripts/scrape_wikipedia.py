"""Scrape Wikipedia for enriched creature data and image URLs."""

import json
import re
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


def query_wikipedia(title: str) -> dict | None:
    """Query Wikipedia API for a page by title. Returns parsed page data or None."""
    cache_file = CACHE_DIR / f"{slugify(title)}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text())

    params = {
        "action": "query",
        "titles": title,
        "prop": "extracts|pageimages|categories",
        "exintro": True,
        "explaintext": True,
        "piprop": "original|thumbnail",
        "pithumbsize": 800,
        "redirects": 1,
        "format": "json",
    }

    resp = SESSION.get(WIKI_API, params=params)
    resp.raise_for_status()
    data = resp.json()

    pages = data.get("query", {}).get("pages", {})
    if not pages:
        return None

    page = next(iter(pages.values()))

    # Page doesn't exist
    if page.get("missing") is not None:
        return None

    result = {
        "pageid": page.get("pageid"),
        "title": page.get("title"),
        "extract": page.get("extract", ""),
        "original_image": page.get("original", {}).get("source"),
        "thumbnail": page.get("thumbnail", {}).get("source"),
        "categories": [
            c["title"] for c in page.get("categories", [])
        ],
    }

    cache_file.write_text(json.dumps(result, indent=2))
    return result


def query_commons_image(title: str, search_suffix: str = "restoration") -> str | None:
    """Try to find an image on Wikimedia Commons for a creature.

    Searches for "{title} {search_suffix}" and returns the first
    non-SVG image URL found.
    """
    params = {
        "action": "query",
        "generator": "search",
        "gsrsearch": f"{title} {search_suffix}",
        "gsrnamespace": 6,  # File namespace
        "gsrlimit": 5,
        "prop": "imageinfo",
        "iiprop": "url|mime",
        "iiurlwidth": 800,
        "format": "json",
    }

    resp = SESSION.get("https://commons.wikimedia.org/w/api.php", params=params)
    resp.raise_for_status()
    data = resp.json()

    pages = data.get("query", {}).get("pages", {})
    if not pages:
        return None

    # Find the first image (not SVG, not icon-sized)
    for page in pages.values():
        for info in page.get("imageinfo", []):
            mime = info.get("mime", "")
            if mime.startswith("image/") and mime != "image/svg+xml":
                return info.get("thumburl") or info.get("url")

    return None


def slugify(name: str) -> str:
    """Convert a name to a filesystem-safe slug."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def extract_diet_from_text(text: str) -> str | None:
    """Try to infer diet from Wikipedia extract text.

    Only matches patterns where the creature itself is described as having
    a certain diet (e.g. "herbivorous dinosaur", "was a carnivore"), not
    incidental mentions like "attacked by predators".
    """
    # Patterns that describe the subject's own diet
    diet_patterns = [
        (r"\b(?:herbivorous|herbivore)\b", "Herbivore"),
        (r"\bplant[- ]eating\b", "Herbivore"),
        (r"\b(?:carnivorous|carnivore)\b", "Carnivore"),
        (r"\b(?:predatory|apex predator)\b", "Carnivore"),
        (r"\b(?:omnivorous|omnivore)\b", "Omnivore"),
        (r"\b(?:piscivorous|piscivore|fish[- ]eating)\b", "Piscivore"),
        (r"\b(?:insectivorous|insectivore)\b", "Insectivore"),
        (r"\b(?:filter[- ]feeder|suspension feeder)\b", "Filter Feeder"),
    ]

    # Only match in the first ~500 chars (the opening description of the creature)
    # to avoid false positives from mentions of other species later in the text
    intro = text[:500].lower()

    for pattern, diet in diet_patterns:
        if re.search(pattern, intro):
            return diet

    return None


def extract_era_from_text(text: str) -> tuple[str | None, str | None]:
    """Try to extract geological era and period from text.

    Looks for "lived during/in the X" or "from the X" patterns to find
    the actual time the creature lived, not incidental mentions of other eras.
    """
    # Look for explicit "lived during/in" or "from the" patterns first
    # These are the most reliable indicators of when the creature actually lived
    lived_pattern = r"(?:lived|live|existing|existed|dating|dates?)\s+(?:during|in|from|to)\s+(?:the\s+)?(.{10,80}?)(?:\.|,|;)"
    from_pattern = r"(?:from|during|of)\s+(?:the\s+)?((?:Late|Early|Middle|Upper|Lower)\s+\w+)\s+(?:period|epoch|age|era)"

    # Check these focused patterns in the first ~600 chars
    intro = text[:600]

    # Try the "lived during" pattern
    m = re.search(lived_pattern, intro, re.I)
    context = m.group(1) if m else None

    # Also try "from the X period" pattern
    if not context:
        m = re.search(from_pattern, intro, re.I)
        context = m.group(1) if m else None

    # If no focused pattern found, use first ~300 chars as context
    # (the opening sentence usually describes when the creature lived)
    if not context:
        context = intro[:300]

    context_lower = context.lower() if context else ""

    # Map of time period keywords to (era, period) tuples
    # Ordered from most specific to least specific
    period_map = [
        ("late cretaceous", ("Cretaceous", "Late Cretaceous")),
        ("early cretaceous", ("Cretaceous", "Early Cretaceous")),
        ("upper cretaceous", ("Cretaceous", "Late Cretaceous")),
        ("lower cretaceous", ("Cretaceous", "Early Cretaceous")),
        ("cretaceous", ("Cretaceous", None)),
        ("late jurassic", ("Jurassic", "Late Jurassic")),
        ("middle jurassic", ("Jurassic", "Middle Jurassic")),
        ("early jurassic", ("Jurassic", "Early Jurassic")),
        ("upper jurassic", ("Jurassic", "Late Jurassic")),
        ("lower jurassic", ("Jurassic", "Early Jurassic")),
        ("jurassic", ("Jurassic", None)),
        ("late triassic", ("Triassic", "Late Triassic")),
        ("middle triassic", ("Triassic", "Middle Triassic")),
        ("early triassic", ("Triassic", "Early Triassic")),
        ("triassic", ("Triassic", None)),
        ("late permian", ("Permian", "Late Permian")),
        ("early permian", ("Permian", "Early Permian")),
        ("permian", ("Permian", None)),
        ("carboniferous", ("Carboniferous", None)),
        ("late devonian", ("Devonian", "Late Devonian")),
        ("devonian", ("Devonian", None)),
        ("silurian", ("Silurian", None)),
        ("ordovician", ("Ordovician", None)),
        ("cambrian", ("Cambrian", None)),
        ("eocene", ("Paleogene", "Eocene")),
        ("oligocene", ("Paleogene", "Oligocene")),
        ("miocene", ("Neogene", "Miocene")),
        ("pliocene", ("Neogene", "Pliocene")),
        ("pleistocene", ("Quaternary", "Pleistocene")),
        ("holocene", ("Quaternary", "Holocene")),
    ]

    for keyword, (era, period) in period_map:
        if keyword in context_lower:
            return era, period

    return None, None


def extract_size_from_text(text: str) -> tuple[float | None, float | None]:
    """Try to extract size (meters) and weight (kg) from Wikipedia text."""
    size = None
    weight = None

    # Look for length in meters
    m = re.search(r"(\d+\.?\d*)\s*(?:to\s*(\d+\.?\d*)\s*)?m(?:eters?|etres?)?\s*(?:long|in length)", text, re.I)
    if m:
        if m.group(2):
            size = (float(m.group(1)) + float(m.group(2))) / 2
        else:
            size = float(m.group(1))

    # Look for length in feet (convert to meters)
    if size is None:
        m = re.search(r"(\d+\.?\d*)\s*(?:to\s*(\d+\.?\d*)\s*)?(?:ft|feet|foot)\s*(?:long|in length)?", text, re.I)
        if m:
            if m.group(2):
                size = ((float(m.group(1)) + float(m.group(2))) / 2) * 0.3048
            else:
                size = float(m.group(1)) * 0.3048

    # Look for weight in kg/tonnes
    m = re.search(r"(\d+[,.]?\d*)\s*(?:to\s*(\d+[,.]?\d*)\s*)?(?:kg|kilograms?)", text, re.I)
    if m:
        w1 = float(m.group(1).replace(",", ""))
        if m.group(2):
            w2 = float(m.group(2).replace(",", ""))
            weight = (w1 + w2) / 2
        else:
            weight = w1

    if weight is None:
        m = re.search(r"(\d+\.?\d*)\s*(?:to\s*(\d+\.?\d*)\s*)?(?:t(?:onnes?)?|metric tons?)\b", text, re.I)
        if m:
            w1 = float(m.group(1)) * 1000
            if m.group(2):
                w2 = float(m.group(2)) * 1000
                weight = (w1 + w2) / 2
            else:
                weight = w1

    return size, weight


def main():
    import sys

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    creatures = json.loads((DATA_DIR / "creatures.json").read_text())

    # Optional: limit to N creatures for testing
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else len(creatures)
    creatures = creatures[:limit]

    enriched = []
    stats = {"found": 0, "no_article": 0, "no_image": 0, "commons_fallback": 0}

    for creature in tqdm(creatures, desc="Scraping Wikipedia"):
        sci_name = creature["scientificName"]
        result = query_wikipedia(sci_name)

        # Copy all original fields
        enriched_creature = dict(creature)

        if result is None:
            stats["no_article"] += 1
            tqdm.write(f"  No article: {sci_name}")
            enriched_creature["wikipediaImageUrl"] = None
            enriched_creature["wikipediaExtract"] = None
            enriched.append(enriched_creature)
            time.sleep(1)
            continue

        stats["found"] += 1

        # Store the Wikipedia extract
        enriched_creature["wikipediaExtract"] = result.get("extract", "")

        # Update era/period from Wikipedia if we can extract it
        wiki_text = result.get("extract", "")
        wiki_era, wiki_period = extract_era_from_text(wiki_text)
        if wiki_era:
            enriched_creature["era"] = wiki_era
        if wiki_period:
            enriched_creature["period"] = wiki_period

        # Update diet if extractable
        wiki_diet = extract_diet_from_text(wiki_text)
        if wiki_diet:
            enriched_creature["diet"] = wiki_diet

        # Update size/weight if extractable
        wiki_size, wiki_weight = extract_size_from_text(wiki_text)
        if wiki_size and wiki_size > 0:
            enriched_creature["sizeMeters"] = round(wiki_size, 1)
        if wiki_weight and wiki_weight > 0:
            enriched_creature["weightKg"] = round(wiki_weight, 0)

        # Get image - prefer life reconstruction from Commons over Wikipedia's
        # main image (which is usually a fossil/skeleton photo)
        image_url = None

        # First try: Commons search for life restoration art
        commons_url = query_commons_image(sci_name, "restoration")
        if commons_url:
            image_url = commons_url
            stats["commons_fallback"] += 1
            time.sleep(1)

        # Second try: Wikipedia article's main image
        if not image_url:
            image_url = result.get("original_image") or result.get("thumbnail")

        # Third try: broader Commons search
        if not image_url:
            tqdm.write(f"  No restoration image for {sci_name}, trying broader search...")
            image_url = query_commons_image(sci_name, "")
            if image_url:
                stats["commons_fallback"] += 1
            else:
                stats["no_image"] += 1
                tqdm.write(f"  No image found anywhere for {sci_name}")
            time.sleep(1)

        enriched_creature["wikipediaImageUrl"] = image_url
        enriched.append(enriched_creature)

        time.sleep(1)  # Rate limiting

    # Write enriched data
    out_path = DATA_DIR / "creatures_enriched.json"
    out_path.write_text(json.dumps(enriched, indent=2))

    print(f"\nDone! Wrote {len(enriched)} creatures to {out_path}")
    print(f"  Articles found: {stats['found']}")
    print(f"  No article: {stats['no_article']}")
    print(f"  Commons fallback: {stats['commons_fallback']}")
    print(f"  No image at all: {stats['no_image']}")

    # Report creatures without images
    no_image = [c["scientificName"] for c in enriched if not c.get("wikipediaImageUrl")]
    if no_image:
        print(f"\nCreatures still missing images ({len(no_image)}):")
        for name in no_image:
            print(f"  - {name}")


if __name__ == "__main__":
    main()
