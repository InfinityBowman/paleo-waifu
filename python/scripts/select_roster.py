"""Select the 40-creature launch roster for the battle system.

Queries the production D1 database to find:
1. All creatures owned by players (prioritized for inclusion)
2. All available creatures with live images
3. Builds a balanced roster: 4 roles × (4 common + 3 uncommon + 2 rare + 1 epic) = 40

Usage:
    uv run python scripts/select_roster.py
"""

from collections import defaultdict
from d1_client import D1Client

# ─── Role Mapping (matches constants.ts) ──────────────────────────────

TYPE_TO_ROLE = {
    "large theropod": "striker",
    "small theropod": "striker",
    "sauropod": "tank",
    "armoured dinosaur": "tank",
    "ceratopsian": "bruiser",
    "euornithopod": "support",
    "Pterosauria": "striker",
    "Ichthyosauria": "support",
    "Plesiosauria": "support",
    "Eurypterida": "striker",
    "Saurischia": "bruiser",
    "Ornithischia": "bruiser",
    "Crocodylia": "bruiser",
    "Proboscidea": "tank",
    "Mammalia": "bruiser",
    "Perissodactyla": "bruiser",
    "Artiodactyla": "support",
    "Condylarthra": "bruiser",
    "Cimolesta": "striker",
    "Multituberculata": "striker",
    "Sirenia": "support",
    "Primates": "support",
    "Lagomorpha": "striker",
    "Rodentia": "striker",
    "Squamata": "striker",
    "Reptilia": "bruiser",
    "Temnospondyli": "support",
    "Urodela": "support",
    "Anura": "striker",
    "Phlyctaeniiformes": "support",
    "Actinolepidiformes": "support",
    "Bothriolepidiformes": "support",
    "Asterolepidiformes": "tank",
    "Asaphida": "tank",
    "Phacopida": "bruiser",
    "Odontopleurida": "support",
    "Corynexochida": "bruiser",
    "Trinucleida": "support",
    "Redlichiida": "bruiser",
    "Hesperornithiformes": "support",
    "Ichthyornithes": "striker",
    "Anseriformes": "support",
    "Columbiformes": "striker",
    "Charadriiformes": "striker",
    "Galliformes": "bruiser",
    "Sphenisciformes": "support",
    "1.0m": "support",
}

DIET_TO_ROLE = {
    "Carnivorous": "striker",
    "Herbivorous": "tank",
    "Piscivorous": "support",
    "Omnivorous": "bruiser",
    "Herbivorous/omnivorous": "tank",
    "Unknown": "bruiser",
}


def get_role(creature: dict) -> str:
    return TYPE_TO_ROLE.get(
        creature["type"], DIET_TO_ROLE.get(creature["diet"], "bruiser")
    )


# ─── Target Distribution ──────────────────────────────────────────────

TARGET = {"common": 4, "uncommon": 3, "rare": 2, "epic": 1}
ROLES = ["striker", "tank", "support", "bruiser"]
RARITY_ORDER = ["common", "uncommon", "rare", "epic"]

# ─── Ability Assignments ─────────────────────────────────────────────
# (active_template_id, passive_template_id) per creature
# See constants.ts for template definitions

ABILITY_ASSIGNMENTS: dict[str, tuple[str, str]] = {
    # ── STRIKERS ──────────────────────────────────────────────────────
    # Commons get bite (no CD) + varied passives for differentiation
    "Coelophysis":      ("bite",           "pack_hunter"),       # famous pack hunter
    "Achillobator":     ("bite",           "predator_instinct"), # raptor, finishes wounded prey
    "Rhamphorhynchus":  ("bite",           "evasive"),           # flying = hard to hit
    "Dimorphodon":      ("bite",           "venomous"),          # unusual fanged teeth
    # Uncommons get cooldown actives
    "Tarbosaurus":      ("crushing_jaw",   "predator_instinct"), # apex predator, massive bite
    "Baryonyx":         ("feeding_frenzy", "venomous"),          # fish hunter, sustain + DoT
    "Acrocanthosaurus": ("bleed",          "pack_hunter"),       # slashing attacks, pack ambush
    # Rares get specialized kits
    "Compsognathus":    ("feeding_frenzy", "pack_hunter"),       # tiny swarm hunters
    "Megalania":        ("venom_strike",   "venomous"),          # actually venomous lizard!
    # Epic gets best-in-class
    "Carnotaurus":      ("crushing_jaw",   "evasive"),           # fast runner + devastating bite

    # ── TANKS ─────────────────────────────────────────────────────────
    # Commons get mixed utility actives
    "Huayangosaurus":   ("tail_sweep",     "thick_hide"),        # stegosaur tail spikes
    "Anchisaurus":      ("herd_formation", "regenerative"),      # early sauropod, herd animal
    "Edaphosaurus":     ("taunt",          "armored_plates"),    # sail draws attention
    "Silvisaurus":      ("headbutt",       "ironclad"),          # ankylosaur headbutt
    # Uncommons get stronger combos
    "Tarchia":          ("headbutt",       "thick_hide"),        # armoured + club tail
    "Hesperosaurus":    ("tail_sweep",     "armored_plates"),    # stegosaur plates
    "Euoplocephalus":   ("taunt",          "ironclad"),          # iconic armoured tank
    # Rares get team-oriented kits
    "Mamenchisaurus":   ("herd_formation", "regenerative"),      # long-neck herd guardian
    "Argentinosaurus":  ("shield_wall",    "territorial"),       # massive, protects allies
    # Epic gets the ultimate tank kit
    "Diplodocus":       ("tail_sweep",     "territorial"),       # iconic tail whip, huge presence

    # ── SUPPORTS ──────────────────────────────────────────────────────
    # Commons get single-purpose actives
    "Homalocephale":    ("mend",           "regenerative"),      # small healer
    "Hesperornis":      ("armor_break",    "none"),              # diving bird, piercing debuff
    "Lycorhinus":       ("rally_cry",      "none"),              # early ornithopod, inspiring
    "Platypterygius":   ("intimidate",     "regenerative"),      # large ichthyosaur, menacing
    # Uncommons get team-wide impact
    "Edmontosaurus":    ("symbiosis",      "regenerative"),      # massive hadrosaur, group heal
    "Maiasaura":        ("mend",           "regenerative"),      # "good mother lizard" = healer
    "Brachylophosaurus":("herd_formation", "none"),              # protective herd behavior
    # Rares get powerful combos
    "Iguanodon":        ("rally_cry",      "regenerative"),      # famous, inspiring presence
    "Rhabdodon":        ("armor_break",    "regenerative"),      # island dwarf, tenacious
    # Epic gets the best support kit
    "Parasaurolophus":  ("symbiosis",      "regenerative"),      # crest = communication = team heal

    # ── BRUISERS ──────────────────────────────────────────────────────
    # Commons get bite/headbutt + front-row passives
    "Protoceratops":    ("headbutt",       "territorial"),       # defends nest aggressively
    "Machimosaurus":    ("bite",           "scavenger"),         # crocodilian ambush + scavenge
    "Psittacosaurus":   ("bite",           "ironclad"),          # tough little ceratopsian
    "Euskelosaurus":    ("tail_sweep",     "territorial"),       # large sauropodomorph
    # Uncommons get cooldown actives
    "Styracosaurus":    ("headbutt",       "scavenger"),         # spiked frill charge
    "Centrosaurus":     ("feeding_frenzy", "ironclad"),          # aggressive ceratopsian
    "Pachyrhinosaurus": ("armor_break",    "territorial"),       # thick-nosed, breaks defenses
    # Rares get specialized combos
    "Teleoceras":       ("headbutt",       "ironclad"),          # rhino charge!
    "Richardoestesia":  ("feeding_frenzy", "scavenger"),         # small predator, opportunistic
    # Epic gets the full bruiser package
    "Chasmosaurus":     ("tail_sweep",     "territorial"),       # big frill, dominates the field
}

# ─── Hand-Curated Roster ──────────────────────────────────────────────
# Prioritizes: recognizable/iconic > player-owned > obscure
# Target ~70% owned by players

CURATED_ROSTER: dict[tuple[str, str], list[str]] = {
    # ── STRIKER (back row, high ATK damage dealers) ──
    ("striker", "common"): [
        "Coelophysis",       # ★ iconic early theropod
        "Achillobator",      # ★ owned, cool raptor
        "Rhamphorhynchus",   # ★ owned pterosaur, well-known
        "Dimorphodon",       # recognizable pterosaur
    ],
    ("striker", "uncommon"): [
        "Tarbosaurus",       # ★ 2x owned, T.rex cousin
        "Baryonyx",          # ★ owned, very recognizable
        "Acrocanthosaurus",  # ★ owned, famous large theropod
    ],
    ("striker", "rare"): [
        "Compsognathus",     # ★ owned, Jurassic Park fame
        "Megalania",         # ★ owned, giant monitor lizard
    ],
    ("striker", "epic"): [
        "Carnotaurus",       # ★ owned, iconic horned theropod
    ],

    # ── TANK (front row, high HP/DEF damage sponges) ──
    ("tank", "common"): [
        "Huayangosaurus",    # ★ owned stegosaur
        "Anchisaurus",       # ★ owned early sauropod
        "Edaphosaurus",      # ★ owned, sail-backed synapsid
        "Silvisaurus",       # ★ owned ankylosaur
    ],
    ("tank", "uncommon"): [
        "Tarchia",           # ★ 2x owned ankylosaur
        "Hesperosaurus",     # ★ owned stegosaur
        "Euoplocephalus",    # famous armoured dinosaur
    ],
    ("tank", "rare"): [
        "Mamenchisaurus",    # ★ 3x owned, long-necked sauropod
        "Argentinosaurus",   # ★ owned, largest dinosaur ever
    ],
    ("tank", "epic"): [
        "Diplodocus",        # ★ owned, iconic sauropod
    ],

    # ── SUPPORT (back row, heals/buffs/debuffs) ──
    ("support", "common"): [
        "Homalocephale",     # ★ owned pachycephalosaur
        "Hesperornis",       # ★ owned, toothed diving bird
        "Lycorhinus",        # ★ owned early ornithopod
        "Platypterygius",    # ★ owned ichthyosaur
    ],
    ("support", "uncommon"): [
        "Edmontosaurus",     # ★ owned, very well-known hadrosaur
        "Maiasaura",         # ★ owned, "good mother lizard"
        "Brachylophosaurus", # ★ owned hadrosaur
    ],
    ("support", "rare"): [
        "Iguanodon",         # one of the first dinosaurs ever discovered
        "Rhabdodon",         # rare euornithopod
    ],
    ("support", "epic"): [
        "Parasaurolophus",   # iconic crested hadrosaur
    ],

    # ── BRUISER (front row, balanced ATK/DEF) ──
    ("bruiser", "common"): [
        "Protoceratops",     # iconic small ceratopsian
        "Machimosaurus",     # ★ owned, giant croc
        "Psittacosaurus",    # well-known parrot lizard
        "Euskelosaurus",     # ★ owned early sauropodomorph
    ],
    ("bruiser", "uncommon"): [
        "Styracosaurus",     # iconic spiked ceratopsian
        "Centrosaurus",      # ★ owned, well-known ceratopsian
        "Pachyrhinosaurus",  # famous thick-nosed ceratopsian
    ],
    ("bruiser", "rare"): [
        "Teleoceras",        # ★ owned, prehistoric rhino
        "Richardoestesia",   # ★ owned saurischian
    ],
    ("bruiser", "epic"): [
        "Chasmosaurus",      # well-known frill ceratopsian
    ],
}


def main():
    db = D1Client()

    # 1. Get all creatures
    print("Querying all creatures...")
    all_creatures = db.query(
        "SELECT id, name, rarity, type, diet, era FROM creature "
        "WHERE rarity != 'legendary'"
    )
    creature_by_name: dict[str, dict] = {}
    for c in all_creatures:
        creature_by_name[c["name"]] = c
    print(f"  Found {len(all_creatures)} non-legendary creatures")

    # 2. Get owned creatures
    print("Querying player-owned creatures...")
    owned = db.query(
        "SELECT uc.creature_id, COUNT(*) as copies "
        "FROM user_creature uc "
        "JOIN creature c ON uc.creature_id = c.id "
        "WHERE c.rarity != 'legendary' "
        "GROUP BY uc.creature_id "
        "ORDER BY copies DESC"
    )
    owned_ids = {o["creature_id"]: o["copies"] for o in owned}
    print(f"  Found {len(owned_ids)} unique owned creatures (non-legendary)")

    # 3. Validate and display curated roster with abilities
    print("\n" + "=" * 90)
    print("CURATED ROSTER (40 CREATURES) WITH ABILITY ASSIGNMENTS")
    print("=" * 90)

    # Active/passive template names for display
    ACTIVE_NAMES = {
        "bite": "Bite", "crushing_jaw": "Crushing Jaw",
        "venom_strike": "Venom Strike", "feeding_frenzy": "Feeding Frenzy",
        "headbutt": "Headbutt", "tail_sweep": "Tail Sweep",
        "bleed": "Bleed", "rally_cry": "Rally Cry",
        "herd_formation": "Herd Formation", "intimidate": "Intimidate",
        "armor_break": "Armor Break", "symbiosis": "Symbiosis",
        "mend": "Mend", "shield_wall": "Shield Wall", "taunt": "Taunt",
    }
    PASSIVE_NAMES = {
        "thick_hide": "Thick Hide", "armored_plates": "Armored Plates",
        "ironclad": "Ironclad", "evasive": "Evasive",
        "predator_instinct": "Predator Instinct", "venomous": "Venomous",
        "territorial": "Territorial", "pack_hunter": "Pack Hunter",
        "regenerative": "Regenerative", "scavenger": "Scavenger",
        "none": "None",
    }

    total = 0
    total_owned = 0
    missing = []
    missing_abilities = []

    for role in ROLES:
        print(f"\n{'─' * 90}")
        print(f"  {role.upper()} (10 creatures)")
        print(f"{'─' * 90}")
        print(
            f"  {'':1s} {'Rarity':10s} | {'Name':22s} | {'Active':16s} | "
            f"{'Passive':18s} | {'Type':20s} | Era"
        )
        print(f"  {'-' * 86}")
        for rarity in RARITY_ORDER:
            names = CURATED_ROSTER.get((role, rarity), [])
            need = TARGET[rarity]
            if len(names) != need:
                print(f"  ⚠ {rarity}: {len(names)} picks but need {need}!")

            for name in names:
                c = creature_by_name.get(name)
                if not c:
                    missing.append(name)
                    print(f"  ✗ {rarity:10s} | {name:22s} | NOT FOUND IN DB")
                    total += 1
                    continue

                actual_role = get_role(c)
                actual_rarity = c["rarity"]
                copies = owned_ids.get(c["id"], 0)
                is_owned = "★" if copies > 0 else " "

                # Ability assignment
                abilities = ABILITY_ASSIGNMENTS.get(name)
                if not abilities:
                    missing_abilities.append(name)
                    active_str = "???"
                    passive_str = "???"
                else:
                    active_str = ACTIVE_NAMES.get(abilities[0], abilities[0])
                    passive_str = PASSIVE_NAMES.get(abilities[1], abilities[1])

                warnings = []
                if actual_role != role:
                    warnings.append(f"role={actual_role}")
                if actual_rarity != rarity:
                    warnings.append(f"rarity={actual_rarity}")
                warn_str = f" ⚠ {', '.join(warnings)}" if warnings else ""

                print(
                    f"  {is_owned} {rarity:10s} | {name:22s} | {active_str:16s} | "
                    f"{passive_str:18s} | {c['type']:20s} | {c['era']}{warn_str}"
                )
                total += 1
                if copies > 0:
                    total_owned += 1

    # 4. Summary
    print(f"\n{'=' * 90}")
    print(f"TOTAL: {total}/40 creatures")
    pct = total_owned / total * 100 if total > 0 else 0
    print(f"  {total_owned} owned by players ({pct:.0f}% accessible)")
    print(f"  {total - total_owned} new (not yet owned by anyone)")

    if missing:
        print(f"\n⚠ MISSING FROM DB: {', '.join(missing)}")
    if missing_abilities:
        print(f"\n⚠ MISSING ABILITY ASSIGNMENTS: {', '.join(missing_abilities)}")

    # 5. Ability distribution check
    print(f"\n{'=' * 90}")
    print("ABILITY DISTRIBUTION")
    print("=" * 90)

    active_counts: dict[str, int] = defaultdict(int)
    passive_counts: dict[str, int] = defaultdict(int)
    for name, (active, passive) in ABILITY_ASSIGNMENTS.items():
        active_counts[active] += 1
        passive_counts[passive] += 1

    print("\n  Active abilities:")
    for aid, count in sorted(active_counts.items(), key=lambda x: -x[1]):
        bar = "█" * count
        print(f"    {ACTIVE_NAMES.get(aid, aid):18s}: {count:2d} {bar}")

    print("\n  Passive abilities:")
    for pid, count in sorted(passive_counts.items(), key=lambda x: -x[1]):
        bar = "█" * count
        print(f"    {PASSIVE_NAMES.get(pid, pid):18s}: {count:2d} {bar}")

    # 6. Era distribution
    print(f"\n{'=' * 90}")
    print("ERA DISTRIBUTION")
    print("=" * 90)
    era_counts: dict[str, int] = defaultdict(int)
    for role in ROLES:
        for rarity in RARITY_ORDER:
            for name in CURATED_ROSTER.get((role, rarity), []):
                c = creature_by_name.get(name)
                if c:
                    era_counts[c["era"]] += 1
    for era, count in sorted(era_counts.items(), key=lambda x: -x[1]):
        bar = "█" * count
        print(f"  {era:20s}: {count:2d} {bar}")


if __name__ == "__main__":
    main()
