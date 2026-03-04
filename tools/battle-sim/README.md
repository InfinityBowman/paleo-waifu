# Battle Simulator

Balance analysis tool for the Paleo Waifu battle system. Runs Monte Carlo simulations against local D1 creature data and outputs terminal reports or CSV for further analysis.

## Prerequisites

- Local D1 database with creature data (run `pnpm db:migrate:local` and seed from the main app first)
- `pnpm install` from the repo root

## Commands

All commands can be run from the repo root:

```bash
pnpm sim              # Run all reports (except creature)
pnpm sim:matchup      # Round-robin 1v1 tournament
pnpm sim:role         # Role vs role effectiveness matrix
pnpm sim:team         # Random team composition analysis
pnpm sim:ability      # Ability win rate correlation
pnpm sim:creature     # Single creature deep dive (requires name)
```

### Creature report

Requires a creature name (partial, case-insensitive match):

```bash
pnpm sim:creature -- "Tyrannosaurus Rex"
pnpm sim:creature -- "stego"
```

## Options

Pass options after `--`:

| Flag           | Description                                             |
| -------------- | ------------------------------------------------------- |
| `--trials <n>` | Override default trial count                            |
| `--csv`        | Output CSV to stdout (decorative output goes to stderr) |

```bash
pnpm sim:matchup -- --trials 500
pnpm sim:role -- --csv > role.csv
pnpm sim:matchup -- --csv --trials 500 > matchup.csv
```

### Default trial counts

| Report   | Default          |
| -------- | ---------------- |
| matchup  | 100 per pair     |
| role     | 1,000 per pair   |
| team     | 10,000 matchups  |
| ability  | 10,000 matchups  |
| creature | 100 per opponent |

## Reports

### Matchup (`sim:matchup`)

Round-robin of all creatures in mono-team 3v3 (same creature x3 per side). Outputs top/bottom 10 creatures by win rate and rarity tier averages.

### Role (`sim:role`)

6x6 matrix of role vs role win rates using the top 3 creatures per role by total stats.

### Team (`sim:team`)

Samples random 3-creature teams and tracks win rate impact of synergies (type, era, diet) and role compositions.

### Ability (`sim:ability`)

Tracks per-ability win rate correlation across random team matchups. Splits results into active and passive ability rankings.

### Creature (`sim:creature`)

Deep dive on a single creature: stat block, overall win rate, win rate by opponent role, best/worst matchups.

## CSV output

Generate all CSVs into `dist/` at once:

```bash
pnpm sim:csv
```

This creates `dist/matchup.csv`, `dist/role.csv`, `dist/team.csv`, and `dist/ability.csv`.

You can also pipe individual reports manually:

```bash
pnpm sim:matchup -- --csv > dist/matchup.csv
```

## Balance notebook

`python/balance.ipynb` reads the CSVs from `dist/` and produces visualizations for evaluating balance. Uses the `paleo-waifu` Jupyter kernel from the `python/` directory.

```bash
pnpm sim:csv                          # Generate CSVs first
cd python && uv sync                  # Install deps (first time)
uv run jupyter notebook balance.ipynb # Open notebook
```
