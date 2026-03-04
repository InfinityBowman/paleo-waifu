"""Apply manually researched creature data to prod D1.

Dry run by default. Use --commit to apply.

Usage:
    uv run python scripts/manual_enrich.py           # dry run
    uv run python scripts/manual_enrich.py --commit   # apply
"""

import argparse
from d1_client import D1Client

# (scientific_name, {field: value, ...})
# Only fills NULL fields — never overwrites existing data.
UPDATES = [
    # ─── LEGENDARY ─────────────────────────────────────────────────────
    ("Anomalocaris canadensis", {"weight_kg": 2, "found_in": "Canada, China, Australia, USA", "period": "Early Cambrian", "era": "Cambrian"}),
    ("Archaeopteryx lithographica", {"weight_kg": 0.9}),
    ("Dunkleosteus terrelli", {"found_in": "USA, Canada, Poland, Belgium, Morocco"}),
    ("Otodus megalodon", {"found_in": "USA, Australia, Japan, Chile, Peru, Morocco"}),
    ("Mosasaurus hoffmannii", {"weight_kg": 5000, "found_in": "Netherlands, USA, Morocco"}),
    ("Protarchaeopteryx robusta", {"weight_kg": 1.8}),
    ("Pteranodon longiceps", {"weight_kg": 25, "found_in": "USA"}),
    ("Quetzalcoatlus northropi", {"weight_kg": 200, "found_in": "USA"}),
    ("Smilodon fatalis", {"found_in": "USA, Brazil, Peru, Argentina"}),
    ("Titanoboa cerrejonensis", {"found_in": "Colombia"}),
    ("Mammuthus primigenius", {"found_in": "Russia, Canada, USA, UK, Germany, China"}),

    # ─── EPIC ──────────────────────────────────────────────────────────
    ("Archidiskodon", {"size_meters": 4, "weight_kg": 10000, "period": "Early Pleistocene"}),
    ("Argentavis magnificens", {"size_meters": 1.7, "weight_kg": 71, "found_in": "Argentina"}),
    ("Arthropleura", {"weight_kg": 50, "found_in": "UK, USA, Germany", "period": "Late Carboniferous", "era": "Carboniferous"}),
    ("Basilosaurus cetoides", {"found_in": "USA, Egypt, Pakistan"}),
    ("Dimetrodon grandis", {"found_in": "USA, Canada, Germany"}),
    ("Dorygnathus banthensis", {"weight_kg": 0.3}),
    ("Elasmosaurus platyurus", {"weight_kg": 2200, "found_in": "USA, Canada"}),
    ("Helicoprion bessonowi", {"weight_kg": 450, "found_in": "USA, Russia, Australia"}),
    ("Hemihipparion", {"size_meters": 1.4, "weight_kg": 150, "found_in": "USA, China, Kenya", "period": "Late Miocene"}),
    ("Hipparion", {"size_meters": 1.4, "weight_kg": 165, "period": "Late Miocene"}),
    ("Hyopsodus", {"weight_kg": 0.4, "period": "Eocene"}),
    ("Ichthyosaurus communis", {"size_meters": 2, "weight_kg": 91, "found_in": "UK, Germany, Belgium"}),
    ("Illaenus", {"size_meters": 0.057, "weight_kg": 0.01, "period": "Middle Ordovician"}),
    ("Leviathan", {"size_meters": 14.5, "weight_kg": 40000, "period": "Late Miocene"}),
    ("Liopleurodon ferox", {"weight_kg": 1700, "found_in": "England, France, Germany, Russia"}),
    ("Mammut americanum", {"period": "Pliocene"}),
    ("Mammut", {"period": "Pliocene"}),
    ("Megatherium americanum", {"size_meters": 6, "found_in": "Argentina, Uruguay, Bolivia, Chile"}),
    ("Micropachycephalosaurus hongtuyanensis", {"weight_kg": 10}),
    ("Paraceratherium bugtiense", {"found_in": "China, Pakistan, Mongolia, Kazakhstan"}),
    ("Parelephas", {"size_meters": 4, "weight_kg": 10000, "period": "Late Pleistocene"}),
    ("Phenacodus primaevus", {"size_meters": 1.5, "weight_kg": 56, "period": "Eocene"}),
    ("Plesiosaurus dolichodeirus", {"weight_kg": 450, "found_in": "UK, Germany"}),
    ("Pliomastodon", {"period": "Pliocene"}),
    ("Sarcosuchus imperator", {"found_in": "Niger, Morocco, Algeria, Brazil"}),
    ("Stylohipparion", {"size_meters": 1.4, "weight_kg": 165, "period": "Pliocene"}),
    ("Phorusrhacos longissimus", {"size_meters": 2, "weight_kg": 130, "found_in": "Argentina, Uruguay, Brazil, USA", "period": "Eocene", "era": "Cenozoic"}),
    ("Yutyrannus huali", {"size_meters": 9, "weight_kg": 1400, "found_in": "China"}),
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply manually researched creature data")
    parser.add_argument("--commit", action="store_true", help="Apply changes to prod D1")
    args = parser.parse_args()

    db = D1Client()

    # Build lookup by scientific_name
    all_creatures = db.query("SELECT id, name, scientific_name, size_meters, weight_kg, found_in, period, era FROM creature")
    by_sci = {c["scientific_name"]: c for c in all_creatures}
    # Also try genus-only match
    by_genus = {}
    for c in all_creatures:
        genus = c["scientific_name"].split()[0]
        if genus not in by_genus:
            by_genus[genus] = c

    applied = []
    skipped = []

    for sci_name, fields in UPDATES:
        creature = by_sci.get(sci_name) or by_genus.get(sci_name.split()[0])
        if not creature:
            skipped.append((sci_name, "not found in DB"))
            continue

        changes = {}
        for field, value in fields.items():
            if creature.get(field) is None or (field == "era" and creature.get(field) == "Unknown"):
                changes[field] = value

        if not changes:
            skipped.append((sci_name, "all fields already populated"))
            continue

        applied.append({
            "id": creature["id"],
            "name": creature["name"],
            "scientific_name": creature["scientific_name"],
            "changes": changes,
        })

    # Report
    if skipped:
        print(f"Skipped {len(skipped)} entries:")
        for name, reason in skipped:
            print(f"  {name:<40} {reason}")

    if not applied:
        print("\nNothing to update.")
        return

    print(f"\n{'DRY RUN — ' if not args.commit else ''}{len(applied)} creatures to update:")
    print(f"{'Name':<35} {'Field':<14} {'Value'}")
    print(f"{'-' * 35} {'-' * 14} {'-' * 20}")
    for u in applied:
        for field, value in u["changes"].items():
            print(f"{u['name']:<35} {field:<14} {value}")

    if not args.commit:
        print("\nDry run. Use --commit to apply.")
        return

    print("\nApplying...")
    for u in applied:
        set_clauses = []
        values = []
        for field, value in u["changes"].items():
            set_clauses.append(f"{field} = ?")
            values.append(value)
        values.append(u["id"])
        db.execute(f"UPDATE creature SET {', '.join(set_clauses)} WHERE id = ?", values)

    print(f"Done! Updated {len(applied)} creatures.")


if __name__ == "__main__":
    main()
