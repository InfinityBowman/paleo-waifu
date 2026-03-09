# Field Sim (All-vs-All) Implementation Plan

Two sims, two questions:

- **Meta Sim** (existing): "What does the metagame converge to?" — genetic algorithm evolving 3v3 teams
- **Field Sim** (new): "Is each creature/role balanced in a vacuum?" — exhaustive round-robin with no selection bias

---

## Phase 1: Field Sim Engine

Build `runFieldReport()` in `tools/battle-sim/src/reports/field.ts` as a sibling to `meta.ts`.

**Two modes:**

1. **Creature round-robin** — every creature vs every creature in 1v1 mono-team battles (N×N/2 pairs). Produces per-creature win rates, role matchup matrix, and rarity tier cross-rates.
2. **Team round-robin** — sample N random 3v3 teams (with formation), each plays M opponents. Captures synergy value, formation impact, and comp-level balance.

**Key decisions:**

- Accept the same `CreatureRecord[]` + override pipeline the meta sim uses (patches, constant overrides, normalize stats, no actives/no passives)
- Stream progress via the same `onProgress` callback pattern so the UI can show a progress bar
- Return a `FieldRunResult` type with the matchup data, win rate distributions, and aggregated stats

**Sanity check:** Run the creature round-robin on the full 40-creature battle seed. Verify win rates form a reasonable distribution (not all 50%, not a single creature at 100%).

### Quality Review

- **Simplicity/DRY** — is the field report reusing `runner.ts` primitives (`runTrials`, `buildTeam`, `assignRow`) or duplicating logic?
- **Bugs/correctness** — does the round-robin correctly handle both-sides play? Are win rates computed symmetrically?
- **Conventions** — project convention consistency e.g. does `field.ts` follow the same patterns as `meta.ts` (progress callback shape, creature record consumption, option passing)?

---

## Phase 2: Result Types & Server Endpoint

Define `FieldRunResult` and related types in `balance-ui/src/shared/types.ts`. Add `POST /api/field-sim` endpoint (or extend `/api/sim` with a `simType` discriminator).

**New types (high-level shape):**

- `FieldRunResult` — creature win rates, role matchup matrix, rarity cross-rates, ability impact rankings, synergy value measurements, balance scorecard metrics
- `FieldSimRequest` — extends shared override config with field-specific options (trials per pair, team sample size, team sample count)
- `FieldProgressEvent` — progress streaming (pairs completed / total)
- Extend `SavedRun` to be a discriminated union: `{ simType: 'meta', result: MetaRunResult }` | `{ simType: 'field', result: FieldRunResult }`

**Sanity check:** Hit the endpoint with a small creature set, confirm SSE progress events stream correctly and the final result parses into the expected type shape.

### Quality Review

- **Simplicity/DRY** — are the new types cleanly separated from meta types or creating a tangled union? Is the override pipeline shared or duplicated between the two endpoint handlers?
- **Bugs/correctness** — does the override pipeline produce identical creature stats for both sim paths? Does the discriminated `SavedRun` union serialize/deserialize correctly from IndexedDB?
- **Conventions** — project convention consistency e.g. SSE event format, error handling, and response headers match the meta sim endpoint

---

## Phase 3: UI — Sim Type Toggle & Results Shell

Modify the balance UI to support both sim types.

**Sidebar changes:**

- Add a sim type selector (toggle or segmented control) above the existing sim controls: "Meta Sim" / "Field Sim"
- Conditionally show relevant options per sim type (meta sim: population/generations/elite rate/mutation rate; field sim: trials per pair, team sample size, team count) and populate with sane defaults
- Shared options stay visible for both (normalize stats, no actives, no passives, synthetic mode)

**Results tab changes:**

- Detect `simType` from the active result and render the appropriate panel
- `ResultsPanel` → existing meta sim visualizations (unchanged)
- `FieldResultsPanel` → new component, empty shell at this point

**History/Compare changes:**

- `RunSummary` gets a `simType` badge
- Compare tab only allows comparing runs of the same sim type
- History list shows sim type indicator

**Sanity check:** Toggle between sim types in the UI. Run a meta sim, switch to field sim, run a field sim. Both results viewable from History. Compare tab disables cross-type comparison.

### Quality Review

- **Simplicity/DRY** — is the sim type toggle cleanly integrated or does it create branching spaghetti in `App.tsx`? Is state management clean (separate state per sim type vs shared state with type discriminator)?
- **Bugs/correctness** — does switching sim types mid-run cause issues? Does auto-restore from IndexedDB correctly detect sim type and render the right panel? Does the meta sim flow remain completely unbroken?
- **Conventions** — project convention consistency e.g. shadcn/ui component usage, Tailwind styling consistency, sidebar layout patterns

---

## Phase 4: Field Sim Visualizations

Build the field sim result visualizations in `FieldResultsPanel`. Each answers a specific balance question.

**Core visualizations:**

| Viz                                 | Question it answers                                                      | Data source                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| **Role matchup heatmap**            | Does rock-paper-scissors exist between roles?                            | Role-vs-role aggregated win rates from creature round-robin                            |
| **Win rate distribution histogram** | Are creatures clustered around 50% (healthy) or spread out (imbalanced)? | Per-creature field win rates                                                           |
| **Outlier table**                   | Which creatures are broken?                                              | Creatures with >60% or <40% field WR, sortable, with best/worst matchup info           |
| **Creature power ranking**          | True strength without selection bias                                     | All creatures ranked by field WR with role/rarity indicators                           |
| **Ability impact table**            | Which abilities actually matter?                                         | Avg WR when ability present vs absent (controlled for role)                            |
| **Synergy value table**             | Are synergies worth building around?                                     | Measured WR delta for teams with vs without each synergy type                          |
| **Balance scorecard**               | Single-glance health check                                               | Gini coefficient of WRs, max WR spread, role WR variance, % of creatures within 45-55% |
| **Rarity tier box plot**            | Is rarity scaling appropriate?                                           | WR distribution per rarity tier                                                        |

**Sanity check:** Run field sim with `normalizeStats` on and off. With normalization, rarity tiers should have similar median WRs. Without, legendaries should be clearly higher.

### Quality Review

- **Simplicity/DRY** — any duplicated chart logic between field and meta results that should be shared? Are the new chart components self-contained or leaking concerns?
- **Bugs/correctness** — do visualizations handle edge cases (empty data, single creature, all same role)? Are heatmap cells correctly oriented (attacker rows, defender columns)?
- **Conventions** — project convention consistency e.g. Recharts usage patterns, tooltip/color token reuse from `results/constants.ts`, shadcn Card layout consistency with existing ResultsPanel

---

## Phase 5: Cross-Sim Insights & Polish

**Cross-sim panel** — connects findings from both sim types when both have been run:

- "Meta presence vs field WR" scatter plot — top-right = genuinely strong AND meta-popular; top-left = meta-popular but not actually strong (carried by synergies/comp); bottom-right = underrated
- Ability ranking comparison — does meta sim ability pick rate correlate with field sim ability impact?
- Role health summary — meta sim role share vs field sim role WR side by side
- Auto-generated text insights

**Polish:**

- `buildFieldTextSummary()` for clipboard export (matching the meta sim's existing text summary)
- Field-sim-specific comparison views in Compare tab (WR distribution overlay, matchup matrix diff)
- Performance validation: creature round-robin should complete in reasonable time

**Sanity check:** Cross-sim panel gracefully handles having only one sim type available (shows a prompt to run the other). Full end-to-end workflow: tune creature stats → run field sim → identify outlier → adjust → re-run → confirm it moved toward 50%.

### Quality Review

- **Simplicity/DRY/elegance** — is the cross-sim panel cleanly isolated or tightly coupled to both result types? Is the text summary following the same builder pattern as the meta sim's `buildTextSummary`?
- **Bugs/correctness** — does the cross-sim scatter correctly source axes from each sim's data? Do comparison views degrade gracefully with mismatched configs?
- **Conventions** — project convention consistency e.g. consistent with existing ComparisonPanel patterns, clipboard export formatting

---

## Phase 6: Summary

- What was built and key decisions made
- Files created/modified
- Suggested next steps (full 615-creature roster testing, notebook integration, etc.)
