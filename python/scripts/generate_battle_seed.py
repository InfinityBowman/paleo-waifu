"""Generate battle seed SQL for the 40-creature launch roster.

Reads creature data from local D1, generates battle_seed.sql containing:
1. creature_battle_stats INSERT statements (4 stats: HP/ATK/DEF/SPD)
2. creature_ability INSERT statements (1 active + 1 passive per creature)

Ability templates are defined in code (battle/constants.ts), not in DB.
The 40-creature roster and ability assignments come from select_roster.py.

Usage:
    uv run python scripts/generate_battle_seed.py
"""

import hashlib
import json
import sqlite3
import struct
from pathlib import Path

from select_roster import (
    ABILITY_ASSIGNMENTS,
    CURATED_ROSTER,
    RARITY_ORDER,
    ROLES,
)

# ─── Rarity Base Stat Totals ────────────────────────────────────────

RARITY_BASE_TOTALS = {
    "common": 105,
    "uncommon": 130,
    "rare": 170,
    "epic": 215,
    "legendary": 280,
}

# ─── Role Stat Distributions (4 stats, no ABL) ──────────────────────
# Matches packages/shared/src/battle/constants.ts ROLE_DISTRIBUTIONS

ROLE_DISTRIBUTIONS = {
    "striker": {"hp": 0.28, "atk": 0.35, "def": 0.15, "spd": 0.22},
    "tank": {"hp": 0.38, "atk": 0.12, "def": 0.35, "spd": 0.15},
    "support": {"hp": 0.38, "atk": 0.10, "def": 0.27, "spd": 0.25},
    "bruiser": {"hp": 0.30, "atk": 0.25, "def": 0.25, "spd": 0.20},
}

# ─── Template Display Names ─────────────────────────────────────────

TEMPLATE_NAMES = {
    "bite": "Bite", "crushing_jaw": "Crushing Jaw",
    "venom_strike": "Venom Strike", "feeding_frenzy": "Feeding Frenzy",
    "headbutt": "Headbutt", "tail_sweep": "Tail Sweep",
    "bleed": "Bleed", "rally_cry": "Rally Cry",
    "herd_formation": "Herd Formation", "intimidate": "Intimidate",
    "armor_break": "Armor Break", "symbiosis": "Symbiosis",
    "mend": "Mend", "shield_wall": "Shield Wall", "taunt": "Taunt",
    "thick_hide": "Thick Hide", "armored_plates": "Spiked Plates",
    "ironclad": "Ironclad", "evasive": "Evasive",
    "predator_instinct": "Predator Instinct", "venomous": "Venomous",
    "territorial": "Territorial", "pack_hunter": "Pack Hunter",
    "regenerative": "Regenerative", "scavenger": "Scavenger",
    "soothing_aura": "Soothing Aura",
    "fortifying_presence": "Fortifying Presence",
    "weakening_strikes": "Weakening Strikes",
    "none": "None",
}


def find_local_d1() -> Path:
    """Find the local D1 SQLite file in .wrangler state."""
    d1_dir = (
        Path(__file__).parent.parent.parent
        / "web"
        / ".wrangler"
        / "state"
        / "v3"
        / "d1"
        / "miniflare-D1DatabaseObject"
    )
    sqlite_files = list(d1_dir.glob("*.sqlite"))
    if not sqlite_files:
        raise FileNotFoundError(f"No SQLite files found in {d1_dir}")
    if len(sqlite_files) > 1:
        print(f"Warning: {len(sqlite_files)} SQLite files found, using first")
    return sqlite_files[0]


def compute_variance(creature_id: str, stat_name: str) -> float:
    """Deterministic per-stat variance between 0.90 and 1.10."""
    seed = hashlib.sha256(f"{creature_id}:{stat_name}".encode()).digest()
    val = struct.unpack(">I", seed[:4])[0] / 0xFFFFFFFF
    return 0.90 + val * 0.20


def compute_stats(creature_id: str, rarity: str, role: str) -> dict[str, int]:
    """Calculate battle stats for a creature (4 stats: HP/ATK/DEF/SPD)."""
    base = RARITY_BASE_TOTALS.get(rarity, 100)
    dist = ROLE_DISTRIBUTIONS[role]
    stats = {}

    for stat_name in ["hp", "atk", "def", "spd"]:
        raw = base * dist[stat_name]
        variance = compute_variance(creature_id, stat_name)
        stats[stat_name] = max(1, round(raw * variance))

    return stats


def escape_sql(s: str) -> str:
    return s.replace("'", "''")


def sql_str(val: str | None) -> str:
    if val is None:
        return "NULL"
    return f"'{escape_sql(val)}'"


def nanoid(name: str) -> str:
    """Deterministic short ID from name."""
    return hashlib.sha256(name.encode()).hexdigest()[:21]


def main():
    # Find and connect to local D1
    db_path = find_local_d1()
    print(f"Reading from: {db_path}")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    # Build roster name list from CURATED_ROSTER
    roster_names: list[str] = []
    roster_role: dict[str, str] = {}  # name → role (from roster key)
    for role in ROLES:
        for rarity in RARITY_ORDER:
            names = CURATED_ROSTER.get((role, rarity), [])
            for name in names:
                roster_names.append(name)
                roster_role[name] = role

    # Look up creatures by name
    placeholders = ", ".join("?" for _ in roster_names)
    cursor = conn.execute(
        f"SELECT id, name, scientific_name, type, diet, rarity "
        f"FROM creature WHERE name IN ({placeholders}) ORDER BY name",
        roster_names,
    )
    creatures = {row["name"]: dict(row) for row in cursor.fetchall()}

    found = len(creatures)
    missing = [n for n in roster_names if n not in creatures]
    if missing:
        print(f"WARNING: {len(missing)} creatures not found in DB: {', '.join(missing)}")
    print(f"Found {found}/{len(roster_names)} roster creatures")

    lines: list[str] = []

    # ── 1. Creature Battle Stats ────────────────────────────────────
    lines.append("-- Creature Battle Stats (40-creature launch roster)")
    role_counts: dict[str, int] = {}
    rarity_counts: dict[str, int] = {}
    creature_data: list[dict] = []

    for name in roster_names:
        c = creatures.get(name)
        if not c:
            continue

        role = roster_role[name]
        stats = compute_stats(c["id"], c["rarity"], role)
        role_counts[role] = role_counts.get(role, 0) + 1
        rarity_counts[c["rarity"]] = rarity_counts.get(c["rarity"], 0) + 1

        creature_data.append(
            {
                "id": c["id"],
                "name": name,
                "scientific_name": c["scientific_name"],
                "type": c["type"],
                "diet": c["diet"],
                "rarity": c["rarity"],
                "role": role,
                "stats": stats,
            }
        )

        lines.append(
            f"INSERT OR REPLACE INTO creature_battle_stats "
            f"(creature_id, role, hp, atk, def, spd) "
            f"VALUES ("
            f"'{c['id']}', '{role}', "
            f"{stats['hp']}, {stats['atk']}, {stats['def']}, {stats['spd']});"
        )
    lines.append("")

    # ── 2. Creature Abilities ───────────────────────────────────────
    lines.append("-- Creature Abilities (1 active + 1 passive per creature)")
    ability_count = 0

    for name in roster_names:
        c = creatures.get(name)
        if not c:
            continue

        assignment = ABILITY_ASSIGNMENTS.get(name)
        if not assignment:
            print(f"  WARNING: No ability assignment for {name}")
            continue

        active_tid, passive_tid = assignment
        cid = c["id"]

        for slot, tid in [("active", active_tid), ("passive", passive_tid)]:
            display_name = TEMPLATE_NAMES.get(tid, tid)
            ability_id = nanoid(f"ca-{cid}-{slot}")
            lines.append(
                f"INSERT OR REPLACE INTO creature_ability "
                f"(id, creature_id, template_id, slot, display_name) "
                f"VALUES ("
                f"'{ability_id}', '{cid}', '{tid}', '{slot}', {sql_str(display_name)});"
            )
            ability_count += 1
    lines.append("")

    conn.close()

    # ── Write output ────────────────────────────────────────────────
    out_path = Path(__file__).parent.parent.parent / "web" / "battle_seed.sql"
    out_path.write_text("\n".join(lines) + "\n")

    print(f"\nGenerated: {out_path}")
    print(f"  Battle stats: {len(creature_data)}")
    print(f"  Abilities: {ability_count}")
    print(f"  Roles: {role_counts}")
    print(f"  Rarities: {rarity_counts}")

    # Also write creature data JSON for reference
    export_path = Path(__file__).parent.parent / "data" / "battle_creatures.json"
    export_data = [
        {
            "creatureId": c["id"],
            "name": c["name"],
            "scientificName": c["scientific_name"],
            "type": c["type"],
            "diet": c["diet"],
            "rarity": c["rarity"],
            "role": c["role"],
        }
        for c in creature_data
    ]
    export_path.parent.mkdir(parents=True, exist_ok=True)
    export_path.write_text(json.dumps(export_data, indent=2) + "\n")
    print(f"  Exported creature data: {export_path}")


if __name__ == "__main__":
    main()
