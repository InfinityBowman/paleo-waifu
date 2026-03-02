# Data Pipeline Expansion Research

Research into expanding the creature collection beyond the current 393 creatures, covering data sources, image sources, and recommended strategies.

## Current Pipeline

**393 creatures** sourced from:
- **NHM Dino Directory** (~309 dinosaurs) — structured text data
- **Wikipedia** (~84 non-dinosaurs) — pterosaurs, marine reptiles, prehistoric mammals, Paleozoic creatures
- **Wikimedia Commons** — life restoration images (CC-licensed)

**Pipeline steps:** `scrape_creatures.py` → `scrape_pbdb.py` → `enrich_descriptions.py` → `clean_descriptions.py` → `download_images.py` → `compute_aspect_ratios.py` → `upload_to_r2.py` → `generate_seed.py` → `pnpm db:seed:local/prod`

**Pipeline dashboard:** `pnpm pipeline` launches a visual dashboard at http://localhost:4200 for running and monitoring pipeline stages (see `tools/pipeline-dashboard/`).

**Creature data fields:** name, scientificName, era, period, diet, sizeMeters, weightKg, rarity, description, funFacts, imageUrl, imageAspectRatio, source, type, foundIn, nameMeaning, pronunciation

---

## Data Sources

### Tier 1: PBDB (Paleobiology Database)

The single best source for expanding the creature list. Could easily take us from 393 to 1000+ creatures.

- **URL:** https://paleobiodb.org/data1.2/
- **License:** CC BY 4.0 (free, commercial use OK with attribution)
- **No API key required**

**What it provides:**
- Taxonomy (phylum through genus)
- Diet, environment, motility, life habit
- First/last appearance ages in millions of years
- Geological intervals (maps to our `era`/`period` fields)
- Reproduction mode
- PhyloPic image reference (silhouettes only)

**Example query — all dinosaur genera:**
```
https://paleobiodb.org/data1.2/taxa/list.json?base_name=Dinosauria&rank=genus&show=ecospace,app,class&vocab=pbdb
```

**Useful clades to query:**
- `Dinosauria` — dinosaurs
- `Pterosauria` — flying reptiles
- `Plesiosauria` — marine reptiles
- `Ichthyosauria` — marine reptiles
- `Synapsida` — mammal-like reptiles and early mammals
- `Crocodylomorpha` — crocodile relatives
- `Temnospondyli` — early amphibians
- `Placodermi` — armored fish

**Field mapping to our schema:**
| PBDB Field | Our Schema Field |
|---|---|
| `taxon_name` | `scientificName` |
| `diet` | `diet` |
| `early_interval` / `late_interval` | `era` / `period` |
| `taxon_environment` | could inform `type` |
| `firstapp_max_ma` / `lastapp_min_ma` | could derive era from Ma values |

**What it lacks:** size/weight data, descriptions, appealing artwork, common names.

### Tier 2: Wikipedia API (already in use)

- Good for descriptions, common names, enrichment
- Our scraper already handles this
- Rate limited (1s between requests, cached responses)
- Could expand by querying more creature lists beyond what we currently scrape

### Tier 3: GBIF (Global Biodiversity Information Facility)

- **URL:** https://api.gbif.org/v1/species/
- 1.6B+ occurrence records, has `isExtinct` filter
- Good for cross-referencing taxonomy and getting vernacular/common names
- Free, open access
- `isExtinct` flag is not always reliable — best used as a supplement to PBDB, not a primary source

### Tier 4: Supplementary Sources

| Source | URL | Use Case | Limitation |
|---|---|---|---|
| **Encyclopedia of Life** | https://eol.org/ | Descriptions, common names, trait data | Quality varies, mostly modern species |
| **NHM Data Portal API** | https://data.nhm.ac.uk/api/3 | Specimen records | We already scrape NHM Dino Directory |
| **Neotoma** | https://www.neotomadb.org/ | Quaternary paleoecology | Only last 2.6M years |
| **PhyloPic** | https://www.phylopic.org/ | Free silhouette images of taxa | Silhouettes only, not character art |

---

## Image Sources

### Option A: Commissioned Art (Preferred)

Hand-drawn art from artist friends. This ensures anatomical/paleontological accuracy that AI generation cannot provide — many extinct creatures have very specific body plans that AI models would get wrong.

**Workflow:**
1. Provide artists with creature reference data (description, size, diet, era, known anatomy)
2. Artists produce art in a consistent PaleoWaifu style
3. Process images through existing `download_images.py` pipeline (resize to 600x800 WebP)
4. Upload to R2 via `upload_to_r2.py`

**For creatures without art yet:** Use a placeholder system (silhouette, "art coming soon" card, or PhyloPic silhouette) so creatures can be in the game before all art is complete.

### Option B: Wikimedia Commons (Current Approach)

- **Already in use** — `scrape_creatures.py` searches for `"{genus} restoration"` on Commons
- **License:** All Commons media is CC BY, CC BY-SA, CC0, or public domain — commercial use OK
- **Pros:** Free, legally clear
- **Cons:** Inconsistent quality and style, many creatures have no life restoration at all
- **Improvement:** Use category-based queries (e.g., `Category:{genus} life restorations`) instead of just search to find more images

### Option C: PhyloPic (Supplementary)

- Free silhouette images of organisms (including extinct taxa)
- **API:** http://api-docs.phylopic.org/v2/
- Could be used for: placeholder images, "mystery/unrevealed" card states, loading states
- License: CC BY/SA per image

### Not Viable

| Source | Why Not |
|---|---|
| **AI Generation** | Inaccurate anatomy — AI has no understanding of actual body plans for obscure extinct creatures. Not worth the risk of spreading misinformation |
| **DeviantArt** | All art individually owned, need per-artist licensing |
| **ArtStation** | Same licensing problem as DeviantArt |
| **Shutterstock / Getty / iStock** | Expensive ($$$), wrong style (stock photos, generic CGI) |

---

## Recommended Strategy

### Phase 1: Expand creature data with PBDB
1. Add a `scrape_pbdb.py` script that queries PBDB for genera across target clades
2. Deduplicate against existing `creatures_enriched.json`
3. Enrich new creatures with Wikipedia descriptions (existing `enrich_descriptions.py`)
4. Assign rarities using existing logic in `scrape_creatures.py`
5. Target: **600-1000 total creatures**

### Phase 2: Art pipeline
1. New creatures enter the game with placeholder images (PhyloPic silhouettes or a generic "art pending" card)
2. Use Wikimedia Commons life restorations where good ones exist (free, accurate)
3. Commission custom art from artist friends — provide them creature data sheets with known anatomy, size, diet, era
4. As art comes in, process through existing `download_images.py` → `upload_to_r2.py` pipeline
5. Creatures are playable immediately; art is a progressive enhancement

### Phase 3: Ongoing enrichment
- Use GBIF for common names in multiple languages
- Use EOL for additional descriptions and trait data
- Community submissions for fun facts
- Periodic re-runs of PBDB queries to catch newly described species

---

## Cost Estimates

| Item | Cost |
|---|---|
| PBDB data | Free (CC BY 4.0) |
| Wikipedia enrichment | Free |
| Wikimedia Commons images | Free |
| PhyloPic placeholders | Free |
| Commissioned art | TBD (depends on artist friends) |
| **Total data pipeline cost** | **Free** |
