"""
Scrape creature data from multiple sources:
1. NHM Dino Directory (309 dinosaurs) - structured text data
2. Wikipedia - non-dinosaur prehistoric creatures + enrichment
3. Wikimedia Commons - life reconstruction images

Usage:
    uv run python scripts/scrape_creatures.py [limit]
"""

import csv
import json
import re
import time
import sys
from html import unescape
from pathlib import Path

import requests
from tqdm import tqdm

DATA_DIR = Path(__file__).parent.parent / "data"
CACHE_DIR = DATA_DIR / "cache"
WIKI_API = "https://en.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "PaleoWaifuBot/1.0 (paleo-waifu gacha game; educational)"

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": USER_AGENT})


# ─── Helpers ─────────────────────────────────────────────────────────────

def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def cached_get(url: str, cache_key: str, params: dict | None = None) -> str:
    """GET with filesystem cache."""
    cache_file = CACHE_DIR / f"{cache_key}.html"
    if cache_file.exists():
        return cache_file.read_text()
    resp = SESSION.get(url, params=params)
    resp.raise_for_status()
    cache_file.write_text(resp.text)
    time.sleep(1)
    return resp.text


def cached_json(url: str, cache_key: str, params: dict | None = None) -> dict:
    """GET JSON with filesystem cache."""
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text())
    resp = SESSION.get(url, params=params)
    resp.raise_for_status()
    data = resp.json()
    cache_file.write_text(json.dumps(data, indent=2))
    time.sleep(1)
    return data


# ─── NHM Scraper ─────────────────────────────────────────────────────────

def parse_nhm_page(html: str, name: str) -> dict | None:
    """Extract structured dinosaur data from an NHM dino directory page."""
    idx = html.find("Pronunciation")
    if idx < 0:
        return None

    chunk = html[idx : idx + 5000]
    clean = re.sub(r"<[^>]+>", " ", chunk)
    clean = unescape(clean)
    clean = re.sub(r"\s+", " ", clean).strip()

    def extract(label: str) -> str | None:
        m = re.search(rf"{label}\s*:\s*(.+?)(?:\s+(?:Name meaning|Type|Length|Weight|Diet|Teeth|Food|How|When|Found|With|The|This|It|A |\.))", clean)
        if m:
            return m.group(1).strip().rstrip(",")
        return None

    # Parse period + time range
    when_match = re.search(r"When they lived\s*:\s*(.+?)(?:Found in|With|The|This|It|A )", clean)
    when_text = when_match.group(1).strip().rstrip(",. ") if when_match else None

    # Parse "Found in"
    found_match = re.search(r"Found in\s*:\s*(.+?)(?:\s+(?:With|The|This|It|A |Triceratops|[A-Z][a-z]+ (?:was|were|is|had|has|might)))", clean)
    found_in = found_match.group(1).strip().rstrip(",. ") if found_match else None

    # Extract description (everything after the structured fields)
    desc_patterns = [
        r"Found in\s*:\s*.+?\s+((?:With|The|This|It|A )[A-Z].+)",
        r"(?:When they lived|Found in)\s*:.+?\s+([A-Z][a-z].{50,})",
    ]
    description = None
    for pat in desc_patterns:
        m = re.search(pat, clean)
        if m:
            description = m.group(1).strip()[:500]
            break

    # Parse length
    length_str = extract("Length")
    length_m = None
    if length_str:
        m = re.search(r"([\d.]+)\s*m", length_str)
        if m:
            length_m = float(m.group(1))

    # Parse weight
    weight_str = extract("Weight")
    weight_kg = None
    if weight_str:
        m = re.search(r"([\d,]+)\s*kg", weight_str)
        if m:
            weight_kg = float(m.group(1).replace(",", ""))

    return {
        "pronunciation": extract("Pronunciation"),
        "nameMeaning": extract("Name meaning"),
        "type": extract("Type of dinosaur"),
        "sizeMeters": length_m,
        "weightKg": weight_kg,
        "diet": extract("Diet"),
        "teeth": extract("Teeth"),
        "food": extract("Food"),
        "movement": extract("How it moved"),
        "when": when_text,
        "foundIn": found_in,
        "description": description,
    }


def scrape_nhm_dinosaurs(limit: int | None = None) -> list[dict]:
    """Scrape NHM Dino Directory for dinosaur data."""
    csv_path = DATA_DIR / "nhm_dinosaurs.csv"
    if not csv_path.exists():
        raise FileNotFoundError(f"Missing {csv_path} - download it first")

    with open(csv_path) as f:
        rows = list(csv.DictReader(f))

    if limit:
        rows = rows[:limit]

    creatures = []
    for row in tqdm(rows, desc="Scraping NHM"):
        name = row["name"].strip()
        species = row.get("species", "").strip()
        scientific_name = f"{name.capitalize()} {species}" if species else name.capitalize()
        link = row.get("link", "").strip()

        creature = {
            "name": name.capitalize(),
            "scientificName": scientific_name,
            "source": "nhm",
        }

        # Parse period from CSV
        period_str = row.get("period", "")
        era, period = parse_csv_period(period_str)
        creature["era"] = era or "Unknown"
        creature["period"] = period

        # Parse diet from CSV
        diet = row.get("diet", "unknown").strip()
        creature["diet"] = diet.capitalize() if diet else "Unknown"

        # Parse length from CSV
        length_str = row.get("length", "").strip()
        if length_str:
            m = re.search(r"([\d.]+)", length_str)
            if m:
                creature["sizeMeters"] = float(m.group(1))

        creature["type"] = row.get("type", "").strip()
        creature["taxonomy"] = row.get("taxonomy", "").strip()
        creature["foundIn"] = row.get("lived_in", "").strip()

        # Scrape the NHM page for richer data
        if link:
            cache_key = f"nhm-{slugify(name)}"
            try:
                html = cached_get(link, cache_key)
                page_data = parse_nhm_page(html, name)
                if page_data:
                    # Merge - NHM page data enriches CSV data
                    if page_data.get("weightKg"):
                        creature["weightKg"] = page_data["weightKg"]
                    if page_data.get("sizeMeters"):
                        creature["sizeMeters"] = page_data["sizeMeters"]
                    if page_data.get("description"):
                        creature["description"] = page_data["description"]
                    if page_data.get("nameMeaning"):
                        creature["nameMeaning"] = page_data["nameMeaning"]
                    if page_data.get("pronunciation"):
                        creature["pronunciation"] = page_data["pronunciation"]
                    if page_data.get("teeth"):
                        creature["teeth"] = page_data["teeth"]
                    if page_data.get("food"):
                        creature["food"] = page_data["food"]
                    if page_data.get("movement"):
                        creature["movement"] = page_data["movement"]
            except Exception as e:
                tqdm.write(f"  Error scraping NHM for {name}: {e}")

        creatures.append(creature)

    return creatures


def parse_csv_period(period_str: str) -> tuple[str | None, str | None]:
    """Parse NHM CSV period string like 'Late Cretaceous 74-70 million years ago'."""
    if not period_str:
        return None, None

    text = period_str.lower()

    period_map = [
        ("late cretaceous", ("Cretaceous", "Late Cretaceous")),
        ("early cretaceous", ("Cretaceous", "Early Cretaceous")),
        ("cretaceous", ("Cretaceous", None)),
        ("late jurassic", ("Jurassic", "Late Jurassic")),
        ("middle jurassic", ("Jurassic", "Middle Jurassic")),
        ("early jurassic", ("Jurassic", "Early Jurassic")),
        ("jurassic", ("Jurassic", None)),
        ("late triassic", ("Triassic", "Late Triassic")),
        ("middle triassic", ("Triassic", "Middle Triassic")),
        ("early triassic", ("Triassic", "Early Triassic")),
        ("triassic", ("Triassic", None)),
        ("late permian", ("Permian", "Late Permian")),
        ("permian", ("Permian", None)),
        ("carboniferous", ("Carboniferous", None)),
        ("devonian", ("Devonian", None)),
        ("silurian", ("Silurian", None)),
        ("ordovician", ("Ordovician", None)),
        ("cambrian", ("Cambrian", None)),
    ]

    for keyword, (era, period) in period_map:
        if keyword in text:
            return era, period

    return None, None


# ─── Wikipedia Scraper (for non-dinosaurs) ───────────────────────────────

# Additional prehistoric creatures not in the NHM Dino Directory
NON_DINOSAUR_CREATURES = [
    # Pterosaurs
    ("Pteranodon", "Pteranodon longiceps"),
    ("Quetzalcoatlus", "Quetzalcoatlus northropi"),
    ("Dimorphodon", "Dimorphodon macronyx"),
    ("Rhamphorhynchus", "Rhamphorhynchus muensteri"),
    ("Pterodactylus", "Pterodactylus antiquus"),
    ("Tropeognathus", "Tropeognathus mesembrinus"),
    ("Tapejara", "Tapejara wellnhoferi"),
    ("Anhanguera", "Anhanguera blittersdorffi"),
    ("Dsungaripterus", "Dsungaripterus weii"),
    ("Nyctosaurus", "Nyctosaurus gracilis"),
    # Marine reptiles
    ("Plesiosaur", "Plesiosaurus dolichodeirus"),
    ("Mosasaurus", "Mosasaurus hoffmannii"),
    ("Ichthyosaurus", "Ichthyosaurus communis"),
    ("Elasmosaurus", "Elasmosaurus platyurus"),
    ("Liopleurodon", "Liopleurodon ferox"),
    ("Kronosaurus", "Kronosaurus queenslandicus"),
    ("Nothosaurus", "Nothosaurus mirabilis"),
    ("Tylosaurus", "Tylosaurus proriger"),
    ("Thalassomedon", "Thalassomedon haningtoni"),
    ("Shonisaurus", "Shonisaurus popularis"),
    ("Ophthalmosaurus", "Ophthalmosaurus icenicus"),
    ("Temnodontosaurus", "Temnodontosaurus platyodon"),
    ("Tanystropheus", "Tanystropheus longobardicus"),
    # Prehistoric mammals
    ("Smilodon", "Smilodon fatalis"),
    ("Woolly Mammoth", "Mammuthus primigenius"),
    ("Woolly Rhinoceros", "Coelodonta antiquitatis"),
    ("Megatherium", "Megatherium americanum"),
    ("Glyptodon", "Glyptodon clavipes"),
    ("Andrewsarchus", "Andrewsarchus mongoliensis"),
    ("Paraceratherium", "Paraceratherium transouralicum"),
    ("Basilosaurus", "Basilosaurus cetoides"),
    ("Ambulocetus", "Ambulocetus natans"),
    ("Pakicetus", "Pakicetus inachus"),
    ("Deinotherium", "Deinotherium giganteum"),
    ("Sivatherium", "Sivatherium giganteum"),
    ("Elasmotherium", "Elasmotherium sibiricum"),
    ("Megalodon", "Otodus megalodon"),
    ("Thylacosmilus", "Thylacosmilus atrox"),
    ("Thylacoleo", "Thylacoleo carnifex"),
    ("Diprotodon", "Diprotodon optatum"),
    ("Procoptodon", "Procoptodon goliah"),
    ("Megalania", "Varanus priscus"),
    ("Arctodus", "Arctodus simus"),
    ("Doedicurus", "Doedicurus clavicaudatus"),
    ("Josephoartigasia", "Josephoartigasia monesi"),
    ("Terror Bird", "Phorusrhacos longissimus"),
    ("Gastornis", "Gastornis gigantea"),
    ("Titanoboa", "Titanoboa cerrejonensis"),
    ("Sarcosuchus", "Sarcosuchus imperator"),
    ("Deinosuchus", "Deinosuchus hatcheri"),
    ("Kaprosuchus", "Kaprosuchus saharicus"),
    ("Quinkana", "Quinkana fortirostrum"),
    # Permian / Paleozoic
    ("Dimetrodon", "Dimetrodon grandis"),
    ("Edaphosaurus", "Edaphosaurus pogonias"),
    ("Gorgonops", "Gorgonops torvus"),
    ("Inostrancevia", "Inostrancevia alexandri"),
    ("Scutosaurus", "Scutosaurus karpinskii"),
    ("Moschops", "Moschops capensis"),
    ("Lystrosaurus", "Lystrosaurus murrayi"),
    ("Diictodon", "Diictodon feliceps"),
    ("Postosuchus", "Postosuchus kirkpatricki"),
    ("Desmatosuchus", "Desmatosuchus spurensis"),
    # Cambrian / ancient
    ("Anomalocaris", "Anomalocaris canadensis"),
    ("Hallucigenia", "Hallucigenia sparsa"),
    ("Opabinia", "Opabinia regalis"),
    ("Wiwaxia", "Wiwaxia corrugata"),
    ("Trilobite", "Paradoxides davidis"),
    ("Eurypterus", "Eurypterus remipes"),
    ("Cameroceras", "Cameroceras trentonense"),
    ("Dunkleosteus", "Dunkleosteus terrelli"),
    ("Tiktaalik", "Tiktaalik roseae"),
    ("Acanthostega", "Acanthostega gunnari"),
    ("Helicoprion", "Helicoprion davisii"),
    ("Cooksonia", "Cooksonia pertoni"),
    ("Aegirocassis", "Aegirocassis benmoulai"),
    ("Arthropleura", "Arthropleura armata"),
    ("Meganeura", "Meganeura monyi"),
    # Birds
    ("Archaeopteryx", "Archaeopteryx lithographica"),
    ("Dodo", "Raphus cucullatus"),
    ("Moa", "Dinornis robustus"),
    ("Haast's Eagle", "Hieraaetus moorei"),
    ("Elephant Bird", "Aepyornis maximus"),
    ("Microraptor", "Microraptor gui"),
    ("Confuciusornis", "Confuciusornis sanctus"),
    ("Argentavis", "Argentavis magnificens"),
    ("Pelagornis", "Pelagornis sandersi"),
    # More notable dinosaurs not in NHM (double-check against NHM list)
    ("Spinosaurus", "Spinosaurus aegyptiacus"),
    ("Giganotosaurus", "Giganotosaurus carolinii"),
    ("Carcharodontosaurus", "Carcharodontosaurus saharicus"),
    ("Therizinosaurus", "Therizinosaurus cheloniformis"),
    ("Deinonychus", "Deinonychus antirrhopus"),
    ("Yutyrannus", "Yutyrannus huali"),
    ("Pachycephalosaurus", "Pachycephalosaurus wyomingensis"),
]


def query_wikipedia(scientific_name: str) -> dict | None:
    """Query Wikipedia for a creature page."""
    cache_key = f"wiki-{slugify(scientific_name)}"
    cache_file = CACHE_DIR / f"{cache_key}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text())

    params = {
        "action": "query",
        "titles": scientific_name,
        "prop": "extracts|pageimages",
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
    if page.get("missing") is not None:
        # Try with just the genus name
        genus = scientific_name.split()[0]
        if genus != scientific_name:
            params["titles"] = genus
            resp = SESSION.get(WIKI_API, params=params)
            resp.raise_for_status()
            data = resp.json()
            pages = data.get("query", {}).get("pages", {})
            if pages:
                page = next(iter(pages.values()))
            if page.get("missing") is not None:
                return None

    result = {
        "pageid": page.get("pageid"),
        "title": page.get("title"),
        "extract": page.get("extract", ""),
        "original_image": page.get("original", {}).get("source"),
        "thumbnail": page.get("thumbnail", {}).get("source"),
    }

    cache_file.write_text(json.dumps(result, indent=2))
    return result


def query_commons_image(name: str, suffix: str = "restoration") -> str | None:
    """Search Wikimedia Commons for a creature image."""
    cache_key = f"commons-{slugify(name)}-{slugify(suffix)}"
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
        resp = SESSION.get(COMMONS_API, params=params)
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
                return info.get("thumburl") or info.get("url")

    return None


def extract_from_wiki(text: str) -> dict:
    """Extract structured data from a Wikipedia extract."""
    result = {}

    # Diet
    intro = text[:500].lower()
    diet_patterns = [
        (r"\b(?:herbivorous|herbivore)\b", "Herbivorous"),
        (r"\bplant[- ]eating\b", "Herbivorous"),
        (r"\b(?:carnivorous|carnivore)\b", "Carnivorous"),
        (r"\b(?:predatory|apex predator)\b", "Carnivorous"),
        (r"\b(?:omnivorous|omnivore)\b", "Omnivorous"),
        (r"\b(?:piscivorous|piscivore|fish[- ]eating)\b", "Piscivorous"),
        (r"\b(?:insectivorous|insectivore)\b", "Insectivorous"),
        (r"\b(?:filter[- ]feeder|suspension feeder)\b", "Filter feeder"),
    ]
    for pattern, diet in diet_patterns:
        if re.search(pattern, intro):
            result["diet"] = diet
            break

    # Era/period
    context = text[:600].lower()
    lived_match = re.search(
        r"(?:lived|existing|existed|dating)\s+(?:during|in|from)\s+(?:the\s+)?(.{10,80}?)(?:\.|,|;)",
        context,
    )
    era_context = lived_match.group(1) if lived_match else context[:300]

    period_map = [
        ("late cretaceous", ("Cretaceous", "Late Cretaceous")),
        ("early cretaceous", ("Cretaceous", "Early Cretaceous")),
        ("cretaceous", ("Cretaceous", None)),
        ("late jurassic", ("Jurassic", "Late Jurassic")),
        ("middle jurassic", ("Jurassic", "Middle Jurassic")),
        ("early jurassic", ("Jurassic", "Early Jurassic")),
        ("jurassic", ("Jurassic", None)),
        ("late triassic", ("Triassic", "Late Triassic")),
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
        if keyword in era_context:
            result["era"] = era
            if period:
                result["period"] = period
            break

    # Size
    m = re.search(r"(\d+\.?\d*)\s*(?:to\s*(\d+\.?\d*)\s*)?m(?:eters?|etres?)?\s*(?:long|in length)", text, re.I)
    if m:
        result["sizeMeters"] = round(
            (float(m.group(1)) + float(m.group(2))) / 2 if m.group(2) else float(m.group(1)),
            1,
        )
    else:
        m = re.search(r"(\d+\.?\d*)\s*(?:to\s*(\d+\.?\d*)\s*)?(?:ft|feet)\s*(?:long|in length)?", text, re.I)
        if m:
            val = (float(m.group(1)) + float(m.group(2))) / 2 if m.group(2) else float(m.group(1))
            result["sizeMeters"] = round(val * 0.3048, 1)

    # Weight
    m = re.search(r"(\d+[,.]?\d*)\s*(?:to\s*(\d+[,.]?\d*)\s*)?(?:kg|kilograms?)", text, re.I)
    if m:
        w = float(m.group(1).replace(",", ""))
        if m.group(2):
            w = (w + float(m.group(2).replace(",", ""))) / 2
        result["weightKg"] = round(w)
    else:
        m = re.search(r"(\d+\.?\d*)\s*(?:to\s*(\d+\.?\d*)\s*)?(?:t(?:onnes?)?|metric tons?)\b", text, re.I)
        if m:
            w = float(m.group(1)) * 1000
            if m.group(2):
                w = (w + float(m.group(2)) * 1000) / 2
            result["weightKg"] = round(w)

    return result


def scrape_non_dinosaurs(nhm_names: set[str], limit: int | None = None) -> list[dict]:
    """Scrape Wikipedia for non-dinosaur prehistoric creatures."""
    # Filter out any that are already in the NHM list
    to_scrape = [
        (common, sci)
        for common, sci in NON_DINOSAUR_CREATURES
        if slugify(common) not in nhm_names and slugify(sci.split()[0]) not in nhm_names
    ]

    if limit:
        to_scrape = to_scrape[:limit]

    creatures = []
    for common_name, scientific_name in tqdm(to_scrape, desc="Scraping Wikipedia"):
        wiki = query_wikipedia(scientific_name)
        time.sleep(1)

        creature = {
            "name": common_name,
            "scientificName": scientific_name,
            "source": "wikipedia",
        }

        if wiki and wiki.get("extract"):
            extracted = extract_from_wiki(wiki["extract"])
            creature["era"] = extracted.get("era", "Unknown")
            creature["period"] = extracted.get("period")
            creature["diet"] = extracted.get("diet", "Unknown")
            creature["sizeMeters"] = extracted.get("sizeMeters")
            creature["weightKg"] = extracted.get("weightKg")
            creature["description"] = wiki["extract"][:500]
        else:
            tqdm.write(f"  No Wikipedia article for {scientific_name}")
            creature["era"] = "Unknown"
            creature["diet"] = "Unknown"

        creatures.append(creature)

    return creatures


def find_image(name: str, scientific_name: str) -> str | None:
    """Find the best image for a creature from Wikimedia Commons."""
    # Try restoration art first
    genus = scientific_name.split()[0]
    url = query_commons_image(genus, "restoration")
    if url:
        return url

    # Try just the genus name
    url = query_commons_image(genus, "")
    if url:
        return url

    # Try common name
    if name.lower() != genus.lower():
        url = query_commons_image(name, "")
        if url:
            return url

    return None


# ─── Rarity Assignment ───────────────────────────────────────────────────

def assign_rarity(creature: dict) -> str:
    """Assign gacha rarity based on creature notability and characteristics."""
    name = creature.get("name", "").lower()
    sci = creature.get("scientificName", "").lower()
    size = creature.get("sizeMeters") or 0

    # Legendary - iconic creatures everyone knows
    legendary = {
        "tyrannosaurus", "triceratops", "brachiosaurus", "spinosaurus",
        "velociraptor", "stegosaurus", "pteranodon", "mosasaurus",
        "megalodon", "woolly mammoth", "smilodon", "dunkleosteus",
        "titanoboa", "quetzalcoatlus", "archaeopteryx", "anomalocaris",
    }
    for l in legendary:
        if l in name or l in sci:
            return "legendary"

    # Epic - well-known, large, or unusual
    epic = {
        "ankylosaurus", "parasaurolophus", "diplodocus", "allosaurus",
        "pachycephalosaurus", "giganotosaurus", "therizinosaurus",
        "plesiosaur", "ichthyosaurus", "dimetrodon", "megatherium",
        "sarcosuchus", "argentavis", "deinonychus", "carnotaurus",
        "yutyrannus", "paraceratherium", "basilosaurus", "helicoprion",
        "arthropleura", "liopleurodon", "elasmosaurus", "terror bird",
        "mammuthus",
    }
    for e in epic:
        if e in name or e in sci:
            return "epic"

    # Rare - moderately well-known or notably large/small
    if size and size > 15:
        return "rare"

    rare = {
        "iguanodon", "oviraptor", "gallimimus", "dilophosaurus",
        "compsognathus", "microraptor", "tiktaalik", "hallucigenia",
        "opabinia", "glyptodon", "megalania", "dodo", "moa",
        "eurypterus", "trilobite", "acanthostega", "gorgonops",
    }
    for r in rare:
        if r in name or r in sci:
            return "rare"

    # Uncommon
    if size and size > 5:
        return "uncommon"

    # Default to common
    return "common"


# ─── Main ────────────────────────────────────────────────────────────────

def main():
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None

    # Phase 1: NHM dinosaurs
    print("=== Phase 1: NHM Dino Directory ===")
    nhm_creatures = scrape_nhm_dinosaurs(limit)
    nhm_names = {slugify(c["name"]) for c in nhm_creatures}
    print(f"  Got {len(nhm_creatures)} dinosaurs from NHM")

    # Phase 2: Non-dinosaur creatures from Wikipedia
    print("\n=== Phase 2: Non-dinosaur creatures from Wikipedia ===")
    wiki_creatures = scrape_non_dinosaurs(nhm_names, limit)
    print(f"  Got {len(wiki_creatures)} non-dinosaur creatures")

    # Combine
    all_creatures = nhm_creatures + wiki_creatures
    print(f"\n=== Total: {len(all_creatures)} creatures ===")

    # Phase 3: Find images for all creatures
    print("\n=== Phase 3: Finding images ===")
    image_count = 0
    for creature in tqdm(all_creatures, desc="Finding images"):
        img_url = find_image(creature["name"], creature["scientificName"])
        creature["wikipediaImageUrl"] = img_url
        if img_url:
            image_count += 1

    print(f"  Found images for {image_count}/{len(all_creatures)} creatures")

    # Phase 4: Assign rarities
    print("\n=== Phase 4: Assigning rarities ===")
    for creature in all_creatures:
        creature["rarity"] = assign_rarity(creature)

    from collections import Counter
    rarity_dist = Counter(c["rarity"] for c in all_creatures)
    print(f"  Rarity distribution: {dict(rarity_dist)}")

    # Phase 5: Clean up and write output
    output = []
    for c in all_creatures:
        output.append({
            "name": c["name"],
            "scientificName": c["scientificName"],
            "era": c.get("era", "Unknown"),
            "period": c.get("period"),
            "diet": c.get("diet", "Unknown"),
            "sizeMeters": c.get("sizeMeters"),
            "weightKg": c.get("weightKg"),
            "rarity": c["rarity"],
            "description": c.get("description", ""),
            "funFacts": [],
            "wikipediaImageUrl": c.get("wikipediaImageUrl"),
            "source": c.get("source"),
            "type": c.get("type"),
            "foundIn": c.get("foundIn"),
            "nameMeaning": c.get("nameMeaning"),
            "pronunciation": c.get("pronunciation"),
        })

    out_path = DATA_DIR / "creatures_enriched.json"
    out_path.write_text(json.dumps(output, indent=2))
    print(f"\nWrote {len(output)} creatures to {out_path}")

    # Report missing images
    no_image = [c["name"] for c in output if not c.get("wikipediaImageUrl")]
    if no_image:
        print(f"\nCreatures missing images ({len(no_image)}):")
        for name in no_image[:20]:
            print(f"  - {name}")
        if len(no_image) > 20:
            print(f"  ... and {len(no_image) - 20} more")


if __name__ == "__main__":
    main()
