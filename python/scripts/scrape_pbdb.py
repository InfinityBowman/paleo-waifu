"""
Scrape PBDB (Paleobiology Database) for additional prehistoric genera
and merge into creatures_enriched.json.

Queries PBDB for genera across target clades, deduplicates against existing
data, maps fields to creature schema, and filters out overly obscure genera.

Default is dry-run (preview only). Use --yolo to actually write.

Usage:
    uv run python scripts/scrape_pbdb.py                # Dry run (preview)
    uv run python scripts/scrape_pbdb.py --yolo          # Write to creatures_enriched.json
    uv run python scripts/scrape_pbdb.py --min-occs 5    # Override min occurrence threshold
"""

import json
import re
import sys
import time
from collections import Counter
from pathlib import Path

import requests
from tqdm import tqdm

DATA_DIR = Path(__file__).parent.parent / "data"
CACHE_DIR = DATA_DIR / "cache"
PBDB_API = "https://paleobiodb.org/data1.2/taxa/list.json"
WIKI_API = "https://en.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "PaleoWaifuBot/1.0 (https://github.com/infinitybowman/paleo-waifu; jacobamaynard@proton.me)"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})

# ─── Clade Configuration ─────────────────────────────────────────────────
# (clade_name, min_fossil_occurrences, max_genera_to_add)

CLADE_CONFIG = [
    ("Dinosauria",       3, 150),   # Fill gaps NHM missed
    ("Pterosauria",      3,  40),
    ("Plesiosauria",     2,  25),
    ("Ichthyosauria",    2,  20),
    ("Mosasauridae",     2,  15),
    ("Synapsida",        3,  40),   # Dimetrodon-era creatures
    ("Crocodylomorpha",  3,  20),
    ("Temnospondyli",    2,  15),
    ("Placodermi",       2,  15),
    ("Mammalia",         5,  40),   # Extinct only, higher threshold
    ("Trilobita",        5,  25),   # Huge clade, aggressive filter
    ("Eurypterida",      2,  15),
]

TARGET_MAX_NEW = 450  # Global cap on new creatures

# ─── Geological Time Mapping ─────────────────────────────────────────────

# (min_ma, max_ma, era_name)
ERA_BOUNDARIES = [
    (0,     66,     "Cenozoic"),
    (66,    145,    "Cretaceous"),
    (145,   201.4,  "Jurassic"),
    (201.4, 251.9,  "Triassic"),
    (251.9, 298.9,  "Permian"),
    (298.9, 358.9,  "Carboniferous"),
    (358.9, 419.2,  "Devonian"),
    (419.2, 443.8,  "Silurian"),
    (443.8, 485.4,  "Ordovician"),
    (485.4, 538.8,  "Cambrian"),
]

# PBDB interval names → our period names
INTERVAL_TO_PERIOD = {
    # Cretaceous stages
    "maastrichtian": "Late Cretaceous",
    "campanian": "Late Cretaceous",
    "santonian": "Late Cretaceous",
    "coniacian": "Late Cretaceous",
    "turonian": "Late Cretaceous",
    "cenomanian": "Late Cretaceous",
    "albian": "Early Cretaceous",
    "aptian": "Early Cretaceous",
    "barremian": "Early Cretaceous",
    "hauterivian": "Early Cretaceous",
    "valanginian": "Early Cretaceous",
    "berriasian": "Early Cretaceous",
    # Jurassic stages
    "tithonian": "Late Jurassic",
    "kimmeridgian": "Late Jurassic",
    "oxfordian": "Late Jurassic",
    "callovian": "Middle Jurassic",
    "bathonian": "Middle Jurassic",
    "bajocian": "Middle Jurassic",
    "aalenian": "Middle Jurassic",
    "toarcian": "Early Jurassic",
    "pliensbachian": "Early Jurassic",
    "sinemurian": "Early Jurassic",
    "hettangian": "Early Jurassic",
    # Triassic stages
    "rhaetian": "Late Triassic",
    "norian": "Late Triassic",
    "carnian": "Late Triassic",
    "ladinian": "Middle Triassic",
    "anisian": "Middle Triassic",
    "olenekian": "Early Triassic",
    "induan": "Early Triassic",
    # Permian stages
    "changhsingian": "Late Permian",
    "wuchiapingian": "Late Permian",
    "capitanian": "Middle Permian",
    "wordian": "Middle Permian",
    "roadian": "Middle Permian",
    "kungurian": "Early Permian",
    "artinskian": "Early Permian",
    "sakmarian": "Early Permian",
    "asselian": "Early Permian",
    # Cenozoic epochs
    "pleistocene": "Pleistocene",
    "pliocene": "Pliocene",
    "miocene": "Miocene",
    "oligocene": "Oligocene",
    "eocene": "Eocene",
    "paleocene": "Paleocene",
    # Broader period names PBDB sometimes returns
    "late cretaceous": "Late Cretaceous",
    "early cretaceous": "Early Cretaceous",
    "late jurassic": "Late Jurassic",
    "middle jurassic": "Middle Jurassic",
    "early jurassic": "Early Jurassic",
    "late triassic": "Late Triassic",
    "middle triassic": "Middle Triassic",
    "early triassic": "Early Triassic",
    "late permian": "Late Permian",
    "middle permian": "Middle Permian",
    "early permian": "Early Permian",
    "late devonian": "Late Devonian",
    "middle devonian": "Middle Devonian",
    "early devonian": "Early Devonian",
    "late carboniferous": "Late Carboniferous",
    "early carboniferous": "Early Carboniferous",
    "late ordovician": "Late Ordovician",
    "middle ordovician": "Middle Ordovician",
    "early ordovician": "Early Ordovician",
    "late cambrian": "Late Cambrian",
    "middle cambrian": "Middle Cambrian",
    "early cambrian": "Early Cambrian",
}

# Cenozoic sub-era mapping
CENOZOIC_ERA_MAP = {
    "Pleistocene": "Quaternary",
    "Pliocene": "Neogene",
    "Miocene": "Neogene",
    "Oligocene": "Paleogene",
    "Eocene": "Paleogene",
    "Paleocene": "Paleogene",
}

# ─── Diet Mapping ────────────────────────────────────────────────────────

DIET_MAP = {
    "herbivore": "Herbivorous",
    "carnivore": "Carnivorous",
    "omnivore": "Omnivorous",
    "piscivore": "Piscivorous",
    "insectivore": "Insectivorous",
    "filter feeder": "Filter feeder",
    "detritivore": "Detritivore",
    "grazer": "Herbivorous",
    "browser": "Herbivorous",
}

# ─── Rarity Overrides ────────────────────────────────────────────────────
# Notable genera that should be elevated if they come through PBDB.
# Most iconic ones are already in the existing data, so these are empty
# or sparsely populated — extend as needed after reviewing results.

EPIC_OVERRIDES = {
    "dorygnathus", "ornithocheirus", "temnodontosaurus",
    "dakosaurus", "nothosaurus", "tanystropheus",
}

RARE_OVERRIDES: set[str] = set()

# Keywords that indicate trace fossils (footprints, eggs) — not real creatures
TRACE_FOSSIL_KEYWORDS = ["ichnogenus", "oogenus", "ichnotaxon", "trace fossil"]


# ─── Helpers ──────────────────────────────────────────────────────────────

def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def request_with_retry(method: str, url: str, max_retries: int = 3, **kwargs) -> requests.Response:
    """HTTP request with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            resp = SESSION.request(method, url, **kwargs)
            if resp.status_code == 429:
                wait = 30 * (2 ** attempt)
                tqdm.write(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
                continue
            return resp
        except (requests.ConnectionError, requests.Timeout) as e:
            if attempt == max_retries - 1:
                raise
            wait = 5 * (2 ** attempt)
            tqdm.write(f"  Connection error, retrying in {wait}s... ({e.__class__.__name__})")
            time.sleep(wait)
    raise requests.ConnectionError(f"Failed after {max_retries} retries")


# ─── PBDB API ─────────────────────────────────────────────────────────────

def query_pbdb_clade(clade: str, min_occs: int) -> list[dict]:
    """Query PBDB for genera in a clade. Uses caching and pagination."""
    cache_file = CACHE_DIR / f"pbdb-{slugify(clade)}.json"
    if cache_file.exists():
        all_records = json.loads(cache_file.read_text())
    else:
        all_records = []
        offset = 0
        limit = 500

        while True:
            params = {
                "base_name": clade,
                "rank": "genus",
                "show": "ecospace,app,class",
                "vocab": "pbdb",
                "limit": limit,
                "offset": offset,
            }
            resp = request_with_retry("GET", PBDB_API, params=params)
            resp.raise_for_status()
            data = resp.json()
            records = data.get("records", [])
            all_records.extend(records)

            if len(records) < limit:
                break
            offset += limit
            time.sleep(0.5)

        cache_file.write_text(json.dumps(all_records, indent=2))

    # Filter by occurrence count, exclude extant taxa, exclude trace fossils
    # PBDB flags: I = ichnotaxon (trace fossil), F = form taxon
    filtered = [
        r for r in all_records
        if r.get("n_occs", 0) >= min_occs
        and r.get("is_extant") != "extant"
        and "I" not in (r.get("flags") or "")
    ]

    return filtered


# ─── Geological Time ──────────────────────────────────────────────────────

def ma_to_era_period(first_max_ma: float | None, early_interval: str | None) -> tuple[str, str | None]:
    """Convert Ma timestamp and PBDB interval to (era, period)."""
    era = "Unknown"
    period = None

    # Try interval name first (more precise)
    if early_interval:
        period = INTERVAL_TO_PERIOD.get(early_interval.lower())

    # Determine era from Ma value
    if first_max_ma is not None:
        for start, end, era_name in ERA_BOUNDARIES:
            if start <= first_max_ma < end:
                era = era_name
                break
        if first_max_ma >= 538.8:
            era = "Precambrian"

    # For Cenozoic, use sub-era if we have a period
    if era == "Cenozoic" and period and period in CENOZOIC_ERA_MAP:
        era = CENOZOIC_ERA_MAP[period]

    return era, period


def pbdb_diet(diet: str | None) -> str:
    if not diet:
        return "Unknown"
    return DIET_MAP.get(diet.lower().strip(), "Unknown")


# ─── Wikipedia Checks ─────────────────────────────────────────────────────

def check_wikipedia_exists(genus: str) -> bool:
    """Check if a Wikipedia article exists for this genus (cached)."""
    cache_file = CACHE_DIR / f"wiki-exists-{slugify(genus)}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text()).get("exists", False)

    params = {
        "action": "query",
        "titles": genus,
        "format": "json",
        "redirects": 1,
    }
    resp = request_with_retry("GET", WIKI_API, params=params)
    resp.raise_for_status()
    data = resp.json()
    pages = data.get("query", {}).get("pages", {})
    exists = not any(p.get("missing") is not None for p in pages.values())

    cache_file.write_text(json.dumps({"exists": exists}))
    time.sleep(1)  # Wikipedia rate limit
    return exists


def query_commons_image(name: str, suffix: str = "restoration") -> str | None:
    """Search Wikimedia Commons for a creature image."""
    cache_key = f"commons-{slugify(name)}-{slugify(suffix) if suffix else 'bare'}"
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        data = json.loads(cache_file.read_text())
    else:
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": f"{name} {suffix}".strip(),
            "gsrnamespace": 6,
            "gsrlimit": 5,
            "prop": "imageinfo",
            "iiprop": "url|mime",
            "iiurlwidth": 800,
            "format": "json",
        }
        resp = request_with_retry("GET", COMMONS_API, params=params)
        resp.raise_for_status()
        data = resp.json()
        cache_file.write_text(json.dumps(data, indent=2))
        time.sleep(1)

    pages = data.get("query", {}).get("pages", {})
    if not pages:
        return None

    for page in pages.values():
        for info in page.get("imageinfo", []):
            mime = info.get("mime", "")
            if mime.startswith("image/") and mime != "image/svg+xml":
                return info.get("url")

    return None


def find_image(genus: str) -> str | None:
    """Find the best image for a genus from Wikimedia Commons."""
    url = query_commons_image(genus, "restoration")
    if url:
        return url
    url = query_commons_image(genus, "")
    return url


# ─── Rarity Assignment ────────────────────────────────────────────────────

def assign_rarity_pbdb(genus: str, n_occs: int, has_wikipedia: bool) -> str:
    """Assign rarity using n_occs, Wikipedia presence, and overrides.

    Tuned to produce a bottom-heavy distribution:
    ~50% common, ~30% uncommon, ~15% rare, ~5% epic, 0% legendary.
    """
    name_lower = genus.lower()

    # Manual overrides
    if name_lower in EPIC_OVERRIDES:
        return "epic"
    if name_lower in RARE_OVERRIDES:
        return "rare"

    # Scoring system — thresholds are high because we already filter
    # for top genera by n_occs, so most have decent occurrence counts
    score = 0

    # n_occs contribution — only truly prolific genera score here
    if n_occs >= 500:
        score += 3
    elif n_occs >= 200:
        score += 2
    elif n_occs >= 100:
        score += 1

    # Wikipedia bonus — only for genuinely well-known genera
    if has_wikipedia and n_occs >= 50:
        score += 1

    # Score → rarity
    if score >= 4:
        return "epic"
    if score >= 3:
        return "rare"
    if score >= 2:
        return "uncommon"
    return "common"


# ─── Schema Mapping ───────────────────────────────────────────────────────

def pbdb_to_creature(record: dict, has_wikipedia: bool, image_url: str | None) -> dict:
    """Convert a PBDB record to the creature schema."""
    genus = record.get("taxon_name", "")
    era, period = ma_to_era_period(
        record.get("firstapp_max_ma"),
        record.get("early_interval"),
    )
    diet = pbdb_diet(record.get("diet"))
    n_occs = record.get("n_occs", 0)
    rarity = assign_rarity_pbdb(genus, n_occs, has_wikipedia)

    return {
        "name": genus,
        "scientificName": genus,
        "era": era,
        "period": period,
        "diet": diet,
        "sizeMeters": None,
        "weightKg": None,
        "rarity": rarity,
        "description": "",
        "funFacts": [],
        "wikipediaImageUrl": image_url,
        "source": "pbdb",
        "type": record.get("order") or record.get("class"),
        "foundIn": None,
        "nameMeaning": None,
        "pronunciation": None,
    }


# ─── Deduplication ────────────────────────────────────────────────────────

def load_existing_genera(path: Path) -> set[str]:
    """Load lowercase genus names from existing creatures_enriched.json."""
    creatures = json.loads(path.read_text())
    genera = set()
    for c in creatures:
        sci = c.get("scientificName", "")
        genus = sci.split()[0].lower() if sci else c.get("name", "").lower()
        genera.add(genus)
    return genera


# ─── Main ─────────────────────────────────────────────────────────────────

def main():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    yolo = "--yolo" in sys.argv

    min_occs_override = None
    for i, arg in enumerate(sys.argv):
        if arg == "--min-occs" and i + 1 < len(sys.argv):
            min_occs_override = int(sys.argv[i + 1])

    # Load existing data
    enriched_path = DATA_DIR / "creatures_enriched.json"
    existing_creatures = json.loads(enriched_path.read_text())
    existing_genera = load_existing_genera(enriched_path)
    print(f"Existing creatures: {len(existing_creatures)} ({len(existing_genera)} unique genera)")

    # ── Phase 1: Query PBDB for all clades ──
    print("\n=== Phase 1: Querying PBDB ===")
    all_new_records = []
    seen_genera: set[str] = set()

    for clade, default_min_occs, max_genera in CLADE_CONFIG:
        min_occs = min_occs_override or default_min_occs
        print(f"\n  {clade} (min_occs={min_occs}, max={max_genera})...")
        records = query_pbdb_clade(clade, min_occs)
        print(f"    Raw: {len(records)} genera above threshold")

        # Deduplicate against existing + already-queued
        new_records = [
            r for r in records
            if r.get("taxon_name", "").lower() not in existing_genera
            and r.get("taxon_name", "").lower() not in seen_genera
        ]
        print(f"    After dedup: {len(new_records)} new genera")

        # Rank by n_occs and cap
        new_records.sort(key=lambda r: r.get("n_occs", 0), reverse=True)
        top_records = new_records[:max_genera]
        print(f"    After cap: {len(top_records)} genera")

        for r in top_records:
            seen_genera.add(r.get("taxon_name", "").lower())
            all_new_records.append(r)

    print(f"\n  Total new genera from PBDB: {len(all_new_records)}")

    # Global cap
    if len(all_new_records) > TARGET_MAX_NEW:
        all_new_records.sort(key=lambda r: r.get("n_occs", 0), reverse=True)
        all_new_records = all_new_records[:TARGET_MAX_NEW]
        print(f"  Trimmed to {TARGET_MAX_NEW} (global cap)")

    # ── Phase 2: Wikipedia checks + image search ──
    print("\n=== Phase 2: Wikipedia check + image search ===")
    new_creatures = []
    wiki_count = 0
    image_count = 0

    skipped_no_wiki = 0
    skipped_no_image = 0
    skipped_dupe_image = 0
    seen_image_urls: set[str] = set()
    for record in tqdm(all_new_records, desc="Processing genera"):
        genus = record.get("taxon_name", "")

        has_wiki = check_wikipedia_exists(genus)
        if not has_wiki:
            skipped_no_wiki += 1
            continue
        wiki_count += 1

        image_url = find_image(genus)
        if not image_url:
            skipped_no_image += 1
            continue

        # Skip if another creature already claimed this image URL
        if image_url in seen_image_urls:
            skipped_dupe_image += 1
            continue
        seen_image_urls.add(image_url)
        image_count += 1

        creature = pbdb_to_creature(record, has_wiki, image_url)
        new_creatures.append(creature)

    # ── Phase 3: Stats ──
    rarity_dist = Counter(c["rarity"] for c in new_creatures)
    era_dist = Counter(c["era"] for c in new_creatures)

    print(f"\n=== Results ===")
    print(f"  New creatures: {len(new_creatures)}")
    print(f"  Skipped (no Wikipedia article): {skipped_no_wiki}")
    print(f"  Skipped (no image): {skipped_no_image}")
    print(f"  Skipped (duplicate image): {skipped_dupe_image}")
    print(f"  With images: {image_count}")
    print(f"  Without images: {len(new_creatures) - image_count}")
    print(f"\n  Rarity distribution:")
    for rarity in ["legendary", "epic", "rare", "uncommon", "common"]:
        count = rarity_dist.get(rarity, 0)
        pct = count / len(new_creatures) * 100 if new_creatures else 0
        print(f"    {rarity}: {count} ({pct:.1f}%)")
    print(f"\n  Era distribution:")
    for era, count in era_dist.most_common():
        print(f"    {era}: {count}")
    print(f"\n  Combined total would be: {len(existing_creatures) + len(new_creatures)}")

    if not yolo:
        print("\n[DRY RUN] Pass --yolo to write to creatures_enriched.json")
        return

    # ── Phase 4: Merge ──
    print("\n=== Merging ===")
    merged = existing_creatures + new_creatures
    enriched_path.write_text(json.dumps(merged, indent=2))
    print(f"  Wrote {len(merged)} total creatures to {enriched_path}")

    no_image = [c["name"] for c in new_creatures if not c.get("wikipediaImageUrl")]
    if no_image:
        print(f"\n  New creatures missing images ({len(no_image)}):")
        for name in no_image[:30]:
            print(f"    - {name}")
        if len(no_image) > 30:
            print(f"    ... and {len(no_image) - 30} more")


if __name__ == "__main__":
    main()
