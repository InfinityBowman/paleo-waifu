"""Generate seed SQL for D1 from creatures.json."""

import json
import hashlib
from pathlib import Path


def nanoid(name: str) -> str:
    """Deterministic short ID from name."""
    return hashlib.sha256(name.encode()).hexdigest()[:21]


def escape_sql(s: str) -> str:
    return s.replace("'", "''")


def main():
    data_dir = Path(__file__).parent.parent / "data"
    creatures = json.loads((data_dir / "creatures.json").read_text())

    lines: list[str] = []
    creature_ids: list[str] = []

    # Insert creatures
    for c in creatures:
        cid = nanoid(c["scientificName"])
        creature_ids.append(cid)
        fun_facts = json.dumps(c.get("funFacts", []))
        lines.append(
            f"INSERT INTO creature (id, name, scientific_name, era, period, diet, "
            f"size_meters, weight_kg, rarity, description, fun_facts, image_url) VALUES ("
            f"'{cid}', "
            f"'{escape_sql(c['name'])}', "
            f"'{escape_sql(c['scientificName'])}', "
            f"'{escape_sql(c['era'])}', "
            f"{('NULL' if not c.get('period') else repr(escape_sql(c['period'])))}, "
            f"'{escape_sql(c['diet'])}', "
            f"{c.get('sizeMeters') or 'NULL'}, "
            f"{c.get('weightKg') or 'NULL'}, "
            f"'{c['rarity']}', "
            f"'{escape_sql(c['description'])}', "
            f"'{escape_sql(fun_facts)}', "
            f"NULL"
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

    out_path = Path(__file__).parent.parent.parent / "drizzle" / "seed.sql"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(lines) + "\n")
    print(f"Generated {out_path} with {len(creatures)} creatures")


if __name__ == "__main__":
    main()
