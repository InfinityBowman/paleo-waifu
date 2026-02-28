"""Clean creature descriptions: strip HTML, truncated tags, and scraped junk."""

import json
import re
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"


def clean_description(text: str) -> str:
    """Strip HTML tags (including truncated ones) and scraped metadata junk."""
    if not text:
        return ""

    # Trim everything from "Taxonomic details" onward — it's scraped metadata
    text = re.split(r"\s*Taxonomic details\b", text)[0]

    # Trim everything from "Discover more" onward — it's navigation junk
    text = re.split(r"\s*Discover more\b", text)[0]

    # Strip complete HTML tags
    text = re.sub(r"<[^>]*>", "", text)

    # Strip truncated/unclosed HTML tags (lone < near end of string)
    text = re.sub(r"<[^>]*$", "", text)

    # Collapse whitespace
    text = re.sub(r"\s+", " ", text).strip()

    # Remove trailing junk (incomplete sentences ending with common artifacts)
    text = text.rstrip(".,;: ")

    return text


def main():
    path = DATA_DIR / "creatures_enriched.json"
    creatures = json.loads(path.read_text())
    print(f"Loaded {len(creatures)} creatures")

    cleaned = 0
    emptied = 0

    for c in creatures:
        original = c.get("description", "")
        result = clean_description(original)

        if result != original:
            cleaned += 1
            if not result and original:
                emptied += 1

        c["description"] = result

    path.write_text(json.dumps(creatures, indent=2))
    print(f"Cleaned {cleaned} descriptions ({emptied} became empty)")

    # Stats
    has_desc = sum(1 for c in creatures if c.get("description"))
    print(f"Creatures with descriptions: {has_desc}/{len(creatures)}")


if __name__ == "__main__":
    main()
