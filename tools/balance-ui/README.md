# Balance UI

Local dev tool for tuning battle balance via a genetic algorithm meta simulator. Tweak creature stats, ability parameters, and global constants, then run simulations to see how the meta shifts.

## Quick Start

```bash
pnpm dev
```

This starts both the API server (http://localhost:4300) and the Vite client (http://localhost:4400) concurrently.

## Architecture

```
Client (React + Vite)        Server (Hono + Node.js)
  port 4400                    port 4300
  ┌──────────┐                ┌──────────────┐
  │ Vite dev │  /api proxy    │ Hono API     │
  │ server   │ ──────────────>│              │
  │          │                │ battle-sim   │──> SQLite (creatures DB)
  │          │  SSE stream    │ meta report  │
  │          │ <──────────────│              │
  └──────────┘                └──────────────┘
```

- **Client**: React 19, Tailwind v4, Recharts, shadcn/ui, IndexedDB for run history persistence
- **Server**: Hono on Node.js, imports `battle-sim` directly for the genetic algorithm and creature data from SQLite

## Features

### Creature Table

Sortable, filterable table of all creatures. Inline-edit HP, ATK, DEF, SPD and swap active/passive abilities per creature. Toggle creatures on/off to exclude them from simulations. Patched values are visually highlighted with delta tooltips.

### Global Knobs

- **Role Adjustments** — Per-role percentage modifiers on each stat (e.g. +10% ATK for all strikers)
- **Rarity Scaling** — Uniform percentage adjustment to all stats for a rarity tier
- **Combat Damage Scale** — Global multiplier on all damage calculations

### Ability Tuning

Per-ability template overrides: cooldowns, effect parameters (multiplier, duration, percent, etc.). Effect-type-aware inputs with base value references.

### Sim Controls

Genetic algorithm parameters:

| Parameter     | Default | Description                          |
| ------------- | ------- | ------------------------------------ |
| Population    | 100     | Teams per generation                 |
| Generations   | 25      | Evolution cycles                     |
| Matches/Team  | 20      | Battles per team per generation      |
| Elite Rate    | 0.1     | Fraction of top teams kept unchanged |
| Mutation Rate | 0.8     | Probability of mutation vs crossover |

**Isolation modes** strip away variables to test specific balance axes:

- **Normalize Stats** — Scale all creatures to 170 total stats
- **No Actives** — Replace all actives with Bite (baseline damage)
- **No Passives** — Disable all passive abilities

### Results

After a sim completes, the Results tab shows:

- **Role Meta Share** — Bar chart with 15-35% target band indicator
- **Role Evolution** — Stacked area chart of role distribution across generations
- **Fitness Progression** — Top and average fitness curves
- **Battle Health** — Average turns per battle (target: 7-10) and genome diversity over time
- **Formation Distribution** — Pie chart of front/back row arrangements
- **Top Creatures** — Leaderboard by appearances in top teams
- **Ability Presence** — Active and passive ability usage in winning teams
- **Hall of Fame** — Top 10 teams with W/L/D records
- **Synergy Presence** — Type-based team synergy frequency

### Run History

Runs auto-save to IndexedDB (max 50, oldest non-starred pruned). Each entry shows config badges, top fitness, avg turns, and a mini role share bar. Star, rename, delete, or view any past run.

### Run Comparison

Select 2-4 runs from History to compare side-by-side:

- Overlaid fitness curves (solid = top, dashed = avg)
- Overlaid turns and diversity curves
- Role meta share delta table
- Creature rank changes with NEW/GONE indicators
- Config diff table highlighting differences

## Scripts

```bash
pnpm dev            # Start both server and client
pnpm dev:server     # Server only (tsx watch)
pnpm dev:client     # Client only (Vite)
pnpm build          # Production build (client + server)
pnpm start          # Run production server
pnpm typecheck      # Typecheck both client and server
```

## Data Flow

1. Server loads creatures from battle-sim's SQLite DB
2. Client fetches creatures and constants, renders the editable table
3. User applies patches (stat overrides, ability swaps, global knobs)
4. On "Run Sim", all patches and options are POSTed to `/api/sim`
5. Server applies overrides, runs the genetic algorithm meta report
6. Progress streams back via SSE (generation-by-generation)
7. Final results are displayed and auto-saved to IndexedDB
