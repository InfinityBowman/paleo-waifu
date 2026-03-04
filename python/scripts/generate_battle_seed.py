"""Generate battle seed SQL from local D1 SQLite database.

Reads creature data from local D1, generates battle_seed.sql containing:
1. ability_template INSERT statements (all 50 templates)
2. creature_battle_stats INSERT statements (Wave 1: creatures with complete data)
3. creature_ability INSERT statements (when --with-abilities flag, reads battle_abilities.json)

Usage:
    uv run python scripts/generate_battle_seed.py                    # Stats + templates only
    uv run python scripts/generate_battle_seed.py --with-abilities   # Include ability assignments
"""

import argparse
import hashlib
import json
import sqlite3
import struct
from pathlib import Path


# ─── Rarity Base Stat Totals ────────────────────────────────────────

RARITY_BASE_TOTALS = {
    "common": 100,
    "uncommon": 130,
    "rare": 170,
    "epic": 220,
    "legendary": 300,
}

# ─── Role Stat Distributions (% of base total) ─────────────────────

ROLE_DISTRIBUTIONS = {
    "striker": {"hp": 0.20, "atk": 0.30, "def": 0.10, "spd": 0.25, "abl": 0.15},
    "tank": {"hp": 0.30, "atk": 0.15, "def": 0.25, "spd": 0.10, "abl": 0.20},
    "scout": {"hp": 0.15, "atk": 0.25, "def": 0.10, "spd": 0.30, "abl": 0.20},
    "support": {"hp": 0.25, "atk": 0.10, "def": 0.20, "spd": 0.15, "abl": 0.30},
    "bruiser": {"hp": 0.25, "atk": 0.25, "def": 0.20, "spd": 0.15, "abl": 0.15},
    "specialist": {"hp": 0.15, "atk": 0.20, "def": 0.10, "spd": 0.25, "abl": 0.30},
}

# ─── Type-to-Role Mapping ───────────────────────────────────────────

TYPE_TO_ROLE = {
    "large theropod": "striker",
    "small theropod": "scout",
    "sauropod": "tank",
    "armoured dinosaur": "tank",
    "ceratopsian": "bruiser",
    "euornithopod": "support",
    "Pterosauria": "scout",
    "Ichthyosauria": "specialist",
    "Plesiosauria": "specialist",
    "Eurypterida": "striker",
    "Saurischia": "bruiser",
    "Ornithischia": "bruiser",
    "Crocodylia": "bruiser",
    "Proboscidea": "tank",
    "Mammalia": "bruiser",
    "Perissodactyla": "bruiser",
    "Artiodactyla": "support",
    "Condylarthra": "bruiser",
    "Cimolesta": "scout",
    "Multituberculata": "scout",
    "Sirenia": "support",
    "Primates": "support",
    "Lagomorpha": "scout",
    "Rodentia": "scout",
    "Squamata": "scout",
    "Reptilia": "bruiser",
    "Temnospondyli": "specialist",
    "Urodela": "specialist",
    "Anura": "scout",
    "Phlyctaeniiformes": "specialist",
    "Actinolepidiformes": "specialist",
    "Bothriolepidiformes": "specialist",
    "Asterolepidiformes": "tank",
    "Asaphida": "tank",
    "Phacopida": "bruiser",
    "Odontopleurida": "specialist",
    "Corynexochida": "bruiser",
    "Trinucleida": "support",
    "Redlichiida": "bruiser",
    "Hesperornithiformes": "specialist",
    "Ichthyornithes": "scout",
    "Anseriformes": "support",
    "Columbiformes": "scout",
    "Charadriiformes": "scout",
    "Galliformes": "bruiser",
    "Sphenisciformes": "specialist",
    # Data error: Lesothosaurus has "1.0m" as type
    "1.0m": "support",
}

DIET_TO_ROLE = {
    "Carnivorous": "striker",
    "Herbivorous": "tank",
    "Piscivorous": "specialist",
    "Omnivorous": "bruiser",
    "Herbivorous/omnivorous": "tank",
    "Unknown": "bruiser",
}

DEFAULT_ROLE = "bruiser"

# ─── Ability Templates ──────────────────────────────────────────────

ABILITY_TEMPLATES = [
    # Active — Damage (single target)
    ("bite", "Bite", "active", "damage", "single_enemy", 1.2, 0, None, None, None, "A powerful bite attack."),
    ("claw_strike", "Claw Strike", "active", "damage", "single_enemy", 1.0, 0, None, "spd", 10.0, "A quick slash that boosts speed this turn."),
    ("horn_charge", "Horn Charge", "active", "damage", "single_enemy", 1.5, 2, None, None, None, "A devastating charging attack with horns."),
    ("crushing_jaw", "Crushing Jaw", "active", "damage", "single_enemy", 1.8, 3, None, None, None, "The strongest single-target bite, crushing bones."),
    ("venom_strike", "Venom Strike", "active", "damage", "single_enemy", 0.8, 2, 3, "poison", 5.0, "A venomous attack that poisons the target for 5% max HP/turn."),
    ("feeding_frenzy", "Feeding Frenzy", "active", "damage", "single_enemy", 1.3, 3, None, "lifesteal", 30.0, "A frenzied attack that heals 30% of damage dealt."),
    ("dive_attack", "Dive Attack", "active", "damage", "single_enemy", 1.4, 4, None, "ignore_def", None, "A diving strike that ignores enemy defense."),
    ("ambush", "Ambush", "active", "damage", "single_enemy", 1.6, 3, None, "back_row_bonus", 0.3, "A surprise attack. Bonus damage when striking from the back row."),
    ("body_slam", "Body Slam", "active", "damage", "single_enemy", 1.3, 2, None, "stun_chance", 30.0, "A heavy slam with a 30% chance to stun."),
    ("leech_bite", "Leech Bite", "active", "damage", "single_enemy", 1.0, 2, None, "lifesteal", 20.0, "A draining bite that heals 20% of damage dealt."),
    ("constrict", "Constrict", "active", "damage", "single_enemy", 1.1, 2, 2, "spd", -20.0, "Wraps around the target, dealing damage and slowing them."),

    # Active — Damage (AoE)
    ("tail_sweep", "Tail Sweep", "active", "aoe_damage", "all_enemies", 0.7, 2, None, None, None, "A sweeping tail strike hitting all enemies."),
    ("stomp", "Stomp", "active", "aoe_damage", "all_enemies", 0.8, 3, None, None, None, "A thunderous stomp shaking the ground beneath all enemies."),
    ("screech", "Screech", "active", "aoe_damage", "all_enemies", 0.6, 2, None, "abl_scaling", None, "A piercing screech that damages all enemies. Scales with Ability Power."),
    ("tidal_wave", "Tidal Wave", "active", "aoe_damage", "all_enemies", 0.7, 3, None, "abl_scaling", None, "A crashing wave of force that damages all enemies. Scales with Ability Power."),
    ("tremor", "Tremor", "active", "aoe_damage", "all_enemies", 0.5, 2, None, None, None, "Shakes the earth, dealing light damage to all enemies."),

    # Active — Buff
    ("rally_cry", "Rally Cry", "active", "buff", "all_allies", None, 4, 3, "atk", 20.0, "A rallying roar that boosts all allies' attack by 20%."),
    ("herd_formation", "Herd Formation", "active", "buff", "all_allies", None, 4, 3, "def", 20.0, "Tightens formation, boosting all allies' defense by 20%."),
    ("adrenaline_rush", "Adrenaline Rush", "active", "buff", "self", None, 3, 2, "spd", 30.0, "A surge of adrenaline boosts speed by 30%."),
    ("apex_roar", "Apex Roar", "active", "buff", "all_allies", None, 5, 2, "atk,def", 15.0, "A fearsome roar that boosts all allies' attack and defense by 15%."),
    ("primal_surge", "Primal Surge", "active", "buff", "self", None, 3, 2, "atk,spd", 25.0, "Primal instincts surge, boosting own attack by 25% and speed by 15%."),
    ("fortify", "Fortify", "active", "buff", "self", None, 3, 3, "def", 30.0, "Hardens defenses, boosting own defense by 30%."),

    # Active — Debuff
    ("intimidate", "Intimidate", "active", "debuff", "single_enemy", None, 3, 3, "atk", -20.0, "An intimidating display that reduces an enemy's attack by 20%."),
    ("mudslide", "Mudslide", "active", "debuff", "all_enemies", None, 4, 2, "spd", -20.0, "Kicks up mud, slowing all enemies by 20%."),
    ("armor_break", "Armor Break", "active", "debuff", "single_enemy", None, 3, 3, "def", -30.0, "Shatters an enemy's armor, reducing defense by 30%."),
    ("spore_cloud", "Spore Cloud", "active", "debuff", "all_enemies", None, 4, 2, "atk", -15.0, "Releases a cloud of spores that weakens all enemies' attack by 15%."),

    # Active — Heal
    ("graze", "Graze", "active", "heal", "self", None, 3, None, "hp", 25.0, "Grazes on nearby flora, healing 25% of max HP."),
    ("symbiosis", "Symbiosis", "active", "heal", "all_allies", None, 4, None, "hp", 15.0, "A symbiotic bond heals all allies for 15% of max HP."),
    ("regenerate", "Regenerate", "active", "heal", "self", None, 4, 3, "hot", 8.0, "Accelerates natural healing, restoring 8% max HP per turn."),
    ("mend", "Mend", "active", "heal", "all_allies", None, 2, None, "hp", 20.0, "Mends the wounds of the lowest-HP ally, healing 20% max HP."),

    # Active — Utility
    ("shell_guard", "Shell Guard", "active", "shield", "self", None, 4, 2, "shield", 30.0, "Retreats into a shell, absorbing up to 30% max HP in damage."),
    ("headbutt", "Headbutt", "active", "stun", "single_enemy", 0.8, 4, 1, "stun", None, "A forceful headbutt that stuns the target for 1 turn."),
    ("counter_stance", "Counter Stance", "active", "buff", "self", None, 3, 1, "reflect", 40.0, "Adopts a defensive stance, reflecting 40% of damage taken this turn."),
    ("taunt", "Taunt", "active", "taunt", "self", None, 3, 2, "taunt", None, "Draws all single-target attacks to self for 2 turns."),

    # Active — DoT
    ("bleed", "Bleed", "active", "dot", "single_enemy", 0.9, 2, 3, "bleed", 4.0, "A slashing wound that bleeds for 4% max HP per turn."),

    # Passive
    ("thick_hide", "Thick Hide", "passive", "passive", None, None, None, None, "damage_reduction", 15.0, "Reduces all incoming damage by 15%."),
    ("predator_instinct", "Predator Instinct", "passive", "passive", None, None, None, None, "atk", 20.0, "+20% ATK against targets below 50% HP."),
    ("herd_mentality", "Herd Mentality", "passive", "passive", None, None, None, None, "all_stats", 10.0, "+10% all stats per ally of the same creature type."),
    ("aquatic_adaptation", "Aquatic Adaptation", "passive", "passive", None, None, None, None, "spd,def", 20.0, "+20% SPD, -10% DEF."),
    ("venomous", "Venomous", "passive", "passive", None, None, None, 2, "poison", 3.0, "Basic attacks apply poison dealing 3% HP/turn for 2 turns."),
    ("evasive", "Evasive", "passive", "passive", None, None, None, None, "dodge", 15.0, "15% chance to dodge attacks."),
    ("apex_predator", "Apex Predator", "passive", "passive", None, None, None, None, "stun_immune,atk", 10.0, "Immune to stun. +10% ATK."),
    ("ancient_resilience", "Ancient Resilience", "passive", "passive", None, None, None, None, "all_stats", 5.0, "+5% all stats per KO'd ally. Last-stand scaling."),
    ("territorial", "Territorial", "passive", "passive", None, None, None, None, "atk,def", 15.0, "+15% ATK and DEF when in the front row."),
    ("pack_hunter", "Pack Hunter", "passive", "passive", None, None, None, None, "atk", 10.0, "+10% ATK per ally still alive."),
    ("regenerative", "Regenerative", "passive", "passive", None, None, None, None, "hot", 3.0, "Heals 3% max HP at the end of each turn."),
    ("camouflage", "Camouflage", "passive", "passive", None, None, None, None, "untargetable", 25.0, "25% chance to not be targeted by single-target abilities."),
    ("armored_plates", "Armored Plates", "passive", "passive", None, None, None, None, "crit_damage_reduction", 50.0, "Reduces critical hit damage taken by 50%."),
    ("thermal_regulation", "Thermal Regulation", "passive", "passive", None, None, None, 2, "debuff_immune", None, "Immune to debuffs for the first 2 turns."),
    ("scavenger", "Scavenger", "passive", "passive", None, None, None, None, "hp", 15.0, "Heals 15% max HP when an enemy is KO'd."),
]


def find_local_d1() -> Path:
    """Find the local D1 SQLite file in .wrangler state."""
    d1_dir = (
        Path(__file__).parent.parent.parent
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


def assign_role(creature_type: str | None, diet: str | None) -> str:
    """Assign a role based on creature type, falling back to diet."""
    if creature_type and creature_type in TYPE_TO_ROLE:
        return TYPE_TO_ROLE[creature_type]
    if diet and diet in DIET_TO_ROLE:
        return DIET_TO_ROLE[diet]
    return DEFAULT_ROLE


def compute_stats(creature_id: str, rarity: str, role: str) -> dict[str, int]:
    """Calculate battle stats for a creature."""
    base = RARITY_BASE_TOTALS.get(rarity, 100)
    dist = ROLE_DISTRIBUTIONS[role]
    stats = {}
    for stat_name in ["hp", "atk", "def", "spd", "abl"]:
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


def sql_num(val: float | int | None) -> str:
    if val is None:
        return "NULL"
    return str(val)


def nanoid(name: str) -> str:
    """Deterministic short ID from name."""
    return hashlib.sha256(name.encode()).hexdigest()[:21]


def main():
    parser = argparse.ArgumentParser(description="Generate battle seed SQL")
    parser.add_argument(
        "--with-abilities",
        action="store_true",
        help="Include ability assignments from battle_abilities.json",
    )
    args = parser.parse_args()

    # Find and connect to local D1
    db_path = find_local_d1()
    print(f"Reading from: {db_path}")
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    lines: list[str] = []

    # ── 1. Ability Templates ────────────────────────────────────────
    lines.append("-- Ability Templates")
    for t in ABILITY_TEMPLATES:
        tid, name, atype, category, target, multiplier, cooldown, duration, stat_affected, effect_value, desc = t
        lines.append(
            f"INSERT OR REPLACE INTO ability_template "
            f"(id, name, type, category, target, multiplier, cooldown, duration, stat_affected, effect_value, description) "
            f"VALUES ("
            f"{sql_str(tid)}, {sql_str(name)}, {sql_str(atype)}, {sql_str(category)}, "
            f"{sql_str(target)}, {sql_num(multiplier)}, {sql_num(cooldown)}, {sql_num(duration)}, "
            f"{sql_str(stat_affected)}, {sql_num(effect_value)}, {sql_str(desc)});"
        )
    lines.append("")

    # ── 2. Creature Battle Stats (Wave 1) ───────────────────────────
    # Wave 1: creatures with complete data (type + diet + size + description)
    cursor = conn.execute(
        "SELECT id, name, scientific_name, type, diet, rarity "
        "FROM creature "
        "WHERE type IS NOT NULL AND diet IS NOT NULL "
        "AND size_meters IS NOT NULL AND description IS NOT NULL "
        "ORDER BY name"
    )
    creatures = cursor.fetchall()
    print(f"Wave 1 creatures: {len(creatures)}")

    lines.append("-- Creature Battle Stats (Wave 1)")
    role_counts: dict[str, int] = {}
    rarity_counts: dict[str, int] = {}
    creature_data: list[dict] = []

    for c in creatures:
        role = assign_role(c["type"], c["diet"])
        stats = compute_stats(c["id"], c["rarity"], role)
        role_counts[role] = role_counts.get(role, 0) + 1
        rarity_counts[c["rarity"]] = rarity_counts.get(c["rarity"], 0) + 1

        creature_data.append(
            {
                "id": c["id"],
                "name": c["name"],
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
            f"(creature_id, role, hp, atk, def, spd, abl) "
            f"VALUES ("
            f"'{c['id']}', '{role}', "
            f"{stats['hp']}, {stats['atk']}, {stats['def']}, {stats['spd']}, {stats['abl']});"
        )
    lines.append("")

    # ── 3. Creature Abilities (optional) ────────────────────────────
    if args.with_abilities:
        abilities_path = Path(__file__).parent.parent / "data" / "battle_abilities.json"
        if not abilities_path.exists():
            print(f"ERROR: {abilities_path} not found. Run ability assignment first.")
            conn.close()
            return

        abilities = json.loads(abilities_path.read_text())
        print(f"Ability assignments: {len(abilities)}")

        lines.append("-- Creature Abilities")
        valid_templates = {t[0] for t in ABILITY_TEMPLATES}

        for a in abilities:
            cid = a["creatureId"]
            for slot in ["active1", "active2", "passive"]:
                assignment = a[slot]
                tid = assignment["templateId"]
                display_name = assignment["displayName"]

                if tid not in valid_templates:
                    print(f"  WARNING: Invalid template '{tid}' for creature {cid}, slot {slot}")
                    continue

                ability_id = nanoid(f"ca-{cid}-{slot}")
                lines.append(
                    f"INSERT OR REPLACE INTO creature_ability "
                    f"(id, creature_id, template_id, slot, display_name) "
                    f"VALUES ("
                    f"'{ability_id}', '{cid}', '{tid}', '{slot}', {sql_str(display_name)});"
                )
        lines.append("")

    conn.close()

    # ── Write output ────────────────────────────────────────────────
    out_path = Path(__file__).parent.parent.parent / "battle_seed.sql"
    out_path.write_text("\n".join(lines) + "\n")

    print(f"\nGenerated: {out_path}")
    print(f"  Templates: {len(ABILITY_TEMPLATES)}")
    print(f"  Battle stats: {len(creature_data)}")
    print(f"  Roles: {role_counts}")
    print(f"  Rarities: {rarity_counts}")

    if args.with_abilities:
        print(f"  Abilities: {len(abilities) * 3}")

    # Also write creature data for LLM ability assignment
    if not args.with_abilities:
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
        export_path.write_text(json.dumps(export_data, indent=2) + "\n")
        print(f"  Exported creature data: {export_path}")


if __name__ == "__main__":
    main()
