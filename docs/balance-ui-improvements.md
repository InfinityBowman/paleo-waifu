# Balance UI Improvements

Planned changes to `tools/balance-ui/` — the battle balance tuning dashboard.

## 1. Run History & Comparison (IndexedDB)

Persist every sim run to IndexedDB so results survive page reloads and can be compared across sessions.

### Storage schema

Each run gets a record:

```ts
interface StoredRun {
  id: string              // nanoid
  timestamp: number
  label: string           // auto-generated or user-editable
  options: SimOptions     // population, generations, etc.
  patches: CreatureOverridePatch[]
  constantsOverrides: ConstantsOverride
  result: MetaRunResult   // full result + snapshots
}
```

### UI changes

- **Run history sidebar/drawer** — list of past runs with timestamp, label, and key stats (top fitness, avg turns, dominant role). Swipe-to-delete or bulk clear.
- **Pin runs for comparison** — checkbox to select 2-4 runs, opens a comparison view.
- **Auto-label runs** — generate labels from config diff (e.g., "normalized, no passives" or "striker ATK +10%"). Editable inline.
- **Star/favorite runs** — mark important runs so they don't get lost in history.

### Comparison view

New "Compare" tab alongside Creatures and Results:

- **Role meta share** — grouped bar chart (like the notebook's multi-run comparison), one cluster per role, one bar per selected run.
- **Fitness progression overlay** — line charts from all selected runs overlaid on the same axes, color-coded by run.
- **Avg turns overlay** — same treatment, with 7-10 target band shown.
- **Diversity overlay** — same.
- **Delta table** — side-by-side table showing each run's final stats with diff highlights (e.g., striker went from 38% to 26%).
- **Creature leaderboard diff** — show which creatures gained/lost meta presence between runs.

### Implementation notes

- Use `idb-keyval` or raw IndexedDB (no heavy deps needed).
- Store runs in a single object store keyed by `id`, with an index on `timestamp`.
- Cap storage at ~50 runs, auto-prune oldest non-starred runs.
- Add an "Export run" button (JSON download) and "Import run" for sharing.

## 2. Multi-Run Averaging

The notebook runs 3 sims in parallel and averages metrics to reduce noise. The UI should support this.

- Add a "Runs to average" input (default 1, max 5) to SimControls.
- Server fires N independent sims, streams progress for each, then sends a merged result.
- Progress bar shows "Run 2/3, Gen 15/50" instead of just gen progress.
- The averaged result gets stored as a single IndexedDB entry (with `runsAveraged: N` metadata).

Alternative: run averaging client-side — fire N sequential `/api/sim` requests and merge DataFrames in the browser. Simpler server, but slower (no parallelism). Could use a Web Worker for the merge math.

## 3. Diagnostic Mode

One-click "Run Diagnostic" that fires the 4 isolation configs (full / no actives / no passives / pure stats) and produces a verdict.

- Button in SimControls: "Run Diagnostic (4 sims)".
- Runs all 4 in parallel on the server (new endpoint or batched requests).
- Results go to a dedicated "Diagnostic" tab showing:
  - Side-by-side role share comparison (grouped bars).
  - Verdict text: "Striker dominates even with pure stats (38%) — fix ROLE_DISTRIBUTIONS" or "Pure stats balanced, issue is ability-driven."
  - Avg turns comparison across configs.
- Each of the 4 runs also gets saved to IndexedDB history.

## 4. Missing Indicators in Results

### Avg turns target band
The role share section has a green/red target band indicator. Avg turns should too:
- Target: 7-10 turns.
- Show a green "All within target" or red "4.4 avg turns — battles too short" banner below the Battle Health chart.

### Per-generation role evolution
`GenerationSnapshot` already has `roleDistribution` — render it as a stacked area chart showing how role shares shift across generations. Reveals whether a role dominates from gen 1 or emerges late.

### Per-generation creature frequency
`creatureFrequency` is in snapshots but unused. A small multiples or heatmap view showing which creatures get "discovered" or fall off during evolution.

## 5. Bulk Creature Editing

Currently every stat override is per-creature. Add bulk operations:

- **"Edit by role"** — select a role, apply a % modifier to all creatures of that role (e.g., "striker ATK -10%").
- **"Edit by rarity"** — same for rarity tiers.
- **"Scale stat"** — select a stat column header, enter a multiplier, applies to all visible (filtered) creatures.
- These generate individual `CreatureOverridePatch` entries under the hood, so they compose with manual edits.

## 6. Export Patches

Turn sim-informed overrides into actionable output:

- **Export as JSON** — download the current patches + constants overrides.
- **Export as SQL** — generate UPDATE statements for the battle stats tables.
- **"Apply to constants"** — generate a diff for `packages/shared/src/battle/constants.ts` showing what `ROLE_DISTRIBUTIONS` or `RARITY_BASE_TOTALS` values to change.
- **Import patches** — load a previously exported JSON to restore a tuning session.

## 7. Fix combatDamageScale Override

`GlobalKnobsPanel` exposes `combatDamageScale` and `applyOverrides` accepts it in `ConstantsOverride`, but the server never passes it through to the sim engine. The knob is currently a no-op. Wire it through to `runMetaReport` or the battle engine's damage calculation.

## 8. Server: Non-blocking Sim Execution

`POST /api/sim` runs `runMetaReport` synchronously inside `ReadableStream.start()`, blocking the event loop for the entire sim duration. Move the sim to a `worker_threads` Worker so the server stays responsive. The worker posts progress messages back, which get forwarded as SSE events.

## Priority Order

1. **Run history + comparison** (IndexedDB) — highest impact, makes the tool actually useful for iterative tuning
2. **Missing indicators** (turns target band, per-gen role evolution) — low effort, high signal
3. **Fix combatDamageScale** — it's a bug, quick fix
4. **Multi-run averaging** — reduces noise significantly
5. **Diagnostic mode** — automates the notebook's best workflow
6. **Bulk editing** — QoL for faster iteration
7. **Export patches** — closes the loop from "sim says this is good" to "apply it"
8. **Non-blocking server** — only matters at high population/generation counts
