"""Generate seed SQL for D1 from creatures_enriched.json (or creatures.json fallback)."""

import json
import hashlib
from pathlib import Path


def nanoid(name: str) -> str:
    """Deterministic short ID from name."""
    return hashlib.sha256(name.encode()).hexdigest()[:21]


def escape_sql(s: str) -> str:
    return s.replace("'", "''")


def sql_str(val: str | None) -> str:
    """Format a string value for SQL, or NULL if empty."""
    if not val:
        return "NULL"
    return f"'{escape_sql(val)}'"


def sql_num(val: float | int | None) -> str:
    """Format a numeric value for SQL, or NULL if empty."""
    if val is None:
        return "NULL"
    return str(val)


def main():
    data_dir = Path(__file__).parent.parent / "data"

    # Prefer enriched data, fall back to original
    enriched_path = data_dir / "creatures_enriched.json"
    original_path = data_dir / "creatures.json"
    source = enriched_path if enriched_path.exists() else original_path
    creatures = json.loads(source.read_text())
    print(f"Reading from {source.name} ({len(creatures)} creatures)")

    lines: list[str] = []
    creature_ids: list[str] = []

    # Insert creatures (OR REPLACE to handle re-seeding)
    for c in creatures:
        cid = nanoid(c["scientificName"])
        creature_ids.append(cid)
        fun_facts = json.dumps(c.get("funFacts", []))

        # Use imageUrl if set (from R2 upload), otherwise NULL
        image_url = c.get("imageUrl")

        lines.append(
            f"INSERT INTO creature (id, name, scientific_name, era, period, diet, "
            f"size_meters, weight_kg, rarity, description, fun_facts, image_url) VALUES ("
            f"'{cid}', "
            f"{sql_str(c.get('name'))}, "
            f"{sql_str(c.get('scientificName'))}, "
            f"{sql_str(c.get('era', 'Unknown'))}, "
            f"{sql_str(c.get('period'))}, "
            f"{sql_str(c.get('diet', 'Unknown'))}, "
            f"{sql_num(c.get('sizeMeters'))}, "
            f"{sql_num(c.get('weightKg'))}, "
            f"{sql_str(c.get('rarity', 'common'))}, "
            f"'{escape_sql(c.get('description') or '')}', "
            f"{sql_str(fun_facts)}, "
            f"{sql_str(image_url)}"
            f");"
        )

    # Create a default banner with all creatures
    banner_id = nanoid("default-banner")
    lines.append("")
    lines.append(
        f"INSERT INTO banner (id, name, description, starts_at, is_active) VALUES ("
        f"'{banner_id}', "
        f"'Mesozoic Mayhem', "
        f"'All prehistoric creatures available!', "
        f"0, "
        f"1);"
    )

    # Add all creatures to banner pool
    for cid in creature_ids:
        pool_id = nanoid(f"pool-{banner_id}-{cid}")
        lines.append(
            f"INSERT INTO banner_pool (id, banner_id, creature_id) VALUES ("
            f"'{pool_id}', '{banner_id}', '{cid}');"
        )

    out_path = Path(__file__).parent.parent.parent / "seed.sql"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines) + "\n")

    from collections import Counter
    rarities = Counter(c.get("rarity", "common") for c in creatures)
    print(f"Generated {out_path} with {len(creatures)} creatures")
    print(f"  Rarities: {dict(rarities)}")


if __name__ == "__main__":
    main()
