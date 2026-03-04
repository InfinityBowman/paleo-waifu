"""Enrich creatures with location, period, and type data from PBDB.

Queries prod D1 for creatures (primarily PBDB-sourced) missing found_in,
period, or type, then fetches data from the Paleobiology Database API.

- found_in: aggregated from PBDB occurrence records (most common country)
- period: mapped from PBDB early_interval field
- type: mapped from PBDB order/class taxonomy

Dry run by default — prints what would change. Use --commit to apply.

Usage:
    uv run python scripts/enrich_pbdb.py                  # dry run
    uv run python scripts/enrich_pbdb.py --commit          # apply changes
    uv run python scripts/enrich_pbdb.py --all-sources     # include non-PBDB creatures
"""

import argparse
import json
import random
import re
import time
from collections import Counter
from pathlib import Path

import requests
from tqdm import tqdm

from d1_client import D1Client

DATA_DIR = Path(__file__).parent.parent / "data"
CACHE_DIR = DATA_DIR / "cache" / "pbdb-enrich"

PBDB_TAXA_API = "https://paleobiodb.org/data1.2/taxa/list.json"
PBDB_OCCS_API = "https://paleobiodb.org/data1.2/occs/list.json"
USER_AGENT = "PaleoWaifuBot/1.0 (https://github.com/infinitybowman/paleo-waifu; jacobamaynard@proton.me)"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})

# ─── Geological Time Mapping ──────────────────────────────────────────

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
    # Broader period names
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
    "late silurian": "Late Silurian",
    "early silurian": "Early Silurian",
}

# PBDB country code → human-readable country name (common fossil locations)
CC_TO_COUNTRY = {
    "US": "USA", "CA": "Canada", "MX": "Mexico",
    "AR": "Argentina", "BR": "Brazil", "CL": "Chile", "CO": "Colombia",
    "GB": "United Kingdom", "FR": "France", "DE": "Germany", "ES": "Spain",
    "IT": "Italy", "PT": "Portugal", "RO": "Romania", "PL": "Poland",
    "RU": "Russia", "CN": "China", "MN": "Mongolia", "JP": "Japan",
    "IN": "India", "TH": "Thailand", "KZ": "Kazakhstan", "UZ": "Uzbekistan",
    "AU": "Australia", "NZ": "New Zealand",
    "ZA": "South Africa", "MA": "Morocco", "TZ": "Tanzania",
    "EG": "Egypt", "NE": "Niger", "NG": "Nigeria", "ET": "Ethiopia",
    "MG": "Madagascar", "KE": "Kenya",
}


# ─── PBDB API ─────────────────────────────────────────────────────────


def _pbdb_request(url: str, params: dict, max_retries: int = 5) -> dict | None:
    """PBDB API request with exponential backoff and jitter."""
    for attempt in range(max_retries):
        try:
            resp = SESSION.get(url, params=params, timeout=30)

            if resp.status_code == 429:
                wait = 30 * (2 ** attempt) + random.uniform(1, 5)
                tqdm.write(f"  Rate limited, waiting {wait:.0f}s (attempt {attempt + 1}/{max_retries})...")
                time.sleep(wait)
                continue

            if resp.status_code >= 500:
                wait = 10 * (2 ** attempt) + random.uniform(1, 5)
                tqdm.write(f"  Server error {resp.status_code}, retrying in {wait:.0f}s...")
                time.sleep(wait)
                continue

            resp.raise_for_status()
            time.sleep(0.5 + random.uniform(0, 0.5))
            return resp.json()

        except (requests.ConnectionError, requests.Timeout) as e:
            if attempt == max_retries - 1:
                tqdm.write(f"  Failed after {max_retries} retries: {e.__class__.__name__}")
                return None
            wait = 5 * (2 ** attempt) + random.uniform(1, 5)
            tqdm.write(f"  Connection error, retrying in {wait:.0f}s... ({e.__class__.__name__})")
            time.sleep(wait)

    return None


def fetch_pbdb_taxon(genus: str) -> dict | None:
    """Fetch taxon record for a genus, with caching."""
    slug = re.sub(r"[^a-z0-9]+", "-", genus.lower()).strip("-")
    cache_file = CACHE_DIR / f"taxon-{slug}.json"

    if cache_file.exists():
        return json.loads(cache_file.read_text())

    data = _pbdb_request(PBDB_TAXA_API, {
        "base_name": genus,
        "rank": "genus",
        "show": "ecospace,app,class",
        "vocab": "pbdb",
    })

    if data and data.get("records"):
        cache_file.write_text(json.dumps(data, indent=2))
        return data
    return None


def fetch_pbdb_occurrences(genus: str) -> list[dict]:
    """Fetch fossil occurrence records for a genus, with caching."""
    slug = re.sub(r"[^a-z0-9]+", "-", genus.lower()).strip("-")
    cache_file = CACHE_DIR / f"occs-{slug}.json"

    if cache_file.exists():
        return json.loads(cache_file.read_text())

    data = _pbdb_request(PBDB_OCCS_API, {
        "base_name": genus,
        "show": "loc",
        "vocab": "pbdb",
        "limit": 100,
    })

    records = data.get("records", []) if data else []
    cache_file.write_text(json.dumps(records, indent=2))
    return records


# ─── Data Extraction ──────────────────────────────────────────────────


def extract_location(occurrences: list[dict]) -> str | None:
    """Determine primary location from PBDB occurrence records.

    Returns the most common country, or a comma-separated list if there are
    multiple equally common ones.
    """
    countries: list[str] = []
    for occ in occurrences:
        cc = occ.get("cc2", "") or occ.get("cc", "")
        if cc:
            country = CC_TO_COUNTRY.get(cc, cc)
            countries.append(country)

    if not countries:
        return None

    counts = Counter(countries)
    top_count = counts.most_common(1)[0][1]
    # Include all countries that have at least 30% of top count
    threshold = max(1, top_count * 0.3)
    primary = [c for c, n in counts.most_common() if n >= threshold]

    return ", ".join(primary[:3])  # Cap at 3 countries


def extract_period(taxon_data: dict) -> str | None:
    """Extract period from PBDB taxon record's early_interval."""
    records = taxon_data.get("records", [])
    if not records:
        return None

    record = records[0]
    interval = record.get("early_interval", "")
    if interval:
        return INTERVAL_TO_PERIOD.get(interval.lower())
    return None


def extract_type(taxon_data: dict) -> str | None:
    """Extract creature type from PBDB taxon record's order/class."""
    records = taxon_data.get("records", [])
    if not records:
        return None

    record = records[0]
    order = record.get("order", "")
    family = record.get("family", "")
    class_name = record.get("class", "")

    # Use the most specific classification available
    return order or family or class_name or None


def extract_era_from_period(period: str) -> str | None:
    """Derive era from period name for creatures with Unknown era."""
    period_lower = period.lower()
    if "cretaceous" in period_lower:
        return "Cretaceous"
    if "jurassic" in period_lower:
        return "Jurassic"
    if "triassic" in period_lower:
        return "Triassic"
    if "permian" in period_lower:
        return "Permian"
    if "carboniferous" in period_lower:
        return "Carboniferous"
    if "devonian" in period_lower:
        return "Devonian"
    if "silurian" in period_lower:
        return "Silurian"
    if "ordovician" in period_lower:
        return "Ordovician"
    if "cambrian" in period_lower:
        return "Cambrian"
    for epoch in ("pleistocene", "pliocene", "miocene", "oligocene", "eocene", "paleocene"):
        if epoch in period_lower:
            return "Cenozoic"
    return None


# ─── Main ──────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich creatures with PBDB location/period/type data")
    parser.add_argument("--commit", action="store_true", help="Apply changes to prod D1 (default: dry run)")
    parser.add_argument("--all-sources", action="store_true",
                        help="Include non-PBDB creatures (default: PBDB only for location, all for period/type)")
    parser.add_argument("--limit", type=int, default=0, help="Max creatures to process (0 = all)")
    args = parser.parse_args()

    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    db = D1Client()

    # Fetch all creatures that have at least one NULL field we can fill
    sql = """
        SELECT id, name, scientific_name, source, era, period, type, found_in
        FROM creature
        WHERE found_in IS NULL OR period IS NULL OR type IS NULL OR era = 'Unknown'
        ORDER BY name
    """
    creatures = db.query(sql)

    print(f"Found {len(creatures)} creatures with missing location/period/type data")

    if args.limit:
        creatures = creatures[:args.limit]
        print(f"  (limited to {args.limit})")

    updates: list[dict] = []

    for creature in tqdm(creatures, desc="Fetching PBDB"):
        sci_name = creature["scientific_name"]
        genus = sci_name.split()[0]
        source = creature["source"]
        changes: dict = {}

        # Fetch taxon data (for period + type)
        taxon_data = fetch_pbdb_taxon(genus)

        # Period
        if creature["period"] is None and taxon_data:
            period = extract_period(taxon_data)
            if period:
                changes["period"] = period
                # Also fix era if it's Unknown
                if creature["era"] == "Unknown":
                    era = extract_era_from_period(period)
                    if era:
                        changes["era"] = era

        # Fix Unknown era even if period already exists
        if creature["era"] == "Unknown" and "era" not in changes and creature["period"]:
            era = extract_era_from_period(creature["period"])
            if era:
                changes["era"] = era

        # Type
        if creature["type"] is None and taxon_data:
            creature_type = extract_type(taxon_data)
            if creature_type:
                changes["type"] = creature_type

        # Location — only fetch occurrences for PBDB creatures by default
        # (NHM already has good location data, Wikipedia creatures are mixed)
        if creature["found_in"] is None and (source == "pbdb" or args.all_sources):
            occs = fetch_pbdb_occurrences(genus)
            if occs:
                location = extract_location(occs)
                if location:
                    changes["found_in"] = location

        if changes:
            updates.append({
                "id": creature["id"],
                "name": creature["name"],
                "scientific_name": sci_name,
                "source": source,
                "changes": changes,
            })

    # ─── Report ────────────────────────────────────────────────────────

    if not updates:
        print("\nNo new data found.")
        return

    field_counts: Counter = Counter()
    for u in updates:
        for field in u["changes"]:
            field_counts[field] += 1

    print(f"\n{'=' * 90}")
    print(f"{'DRY RUN — ' if not args.commit else ''}Found {len(updates)} creatures to update:")
    print(f"{'=' * 90}")
    print(f"{'Name':<30} {'Field':<12} {'New Value':<30} {'Source'}")
    print(f"{'-' * 30} {'-' * 12} {'-' * 30} {'-' * 10}")

    for u in updates:
        for field, value in u["changes"].items():
            display_val = str(value)[:28]
            print(f"{u['name']:<30} {field:<12} {display_val:<30} {u['source']}")

    print(f"\nSummary: {', '.join(f'{count} {field}' for field, count in field_counts.most_common())}")

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
