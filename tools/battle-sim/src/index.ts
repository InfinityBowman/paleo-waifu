import chalk from 'chalk'
import {  loadCreatures } from './db.ts'
import { runMatchupReport } from './reports/matchup.ts'
import { runTeamReport } from './reports/team.ts'
import { runRoleReport } from './reports/role.ts'
import { runCreatureReport } from './reports/creature.ts'
import { runAbilityReport } from './reports/ability.ts'
import { runMetaReport } from './reports/meta.ts'
import type {CreatureRecord} from './db.ts';

// ─── CLI Argument Parsing ─────────────────────────────────────────

type Command =
  | 'all'
  | 'matchup'
  | 'team'
  | 'role'
  | 'creature'
  | 'ability'
  | 'meta'

const COMMANDS = new Set<Command>([
  'all',
  'matchup',
  'team',
  'role',
  'creature',
  'ability',
  'meta',
])

interface SimArgs {
  command: Command
  creatureName?: string
  trials?: number
  population?: number
  generations?: number
  matchesPerTeam?: number
  normalizeStats: boolean
  noActives: boolean
  noPassives: boolean
  csv: boolean
}

function parseArgs(argv: Array<string>): SimArgs {
  const args = argv.slice(2)
  let command: Command = 'all'
  let creatureName: string | undefined
  let trials: number | undefined
  let population: number | undefined
  let generations: number | undefined
  let matchesPerTeam: number | undefined
  let normalizeStats = false
  let noActives = false
  let noPassives = false
  let csv = false

  const tokens: Array<string> = []

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--') continue // skip pnpm arg separator
    if (args[i] === '--csv') {
      csv = true
    } else if (args[i] === '--normalize-stats') {
      normalizeStats = true
    } else if (args[i] === '--no-actives') {
      noActives = true
    } else if (args[i] === '--no-passives') {
      noPassives = true
    } else if (args[i] === '--trials' && i + 1 < args.length) {
      trials = parseInt(args[i + 1], 10)
      if (isNaN(trials) || trials < 1) {
        console.error('Error: --trials must be a positive integer')
        process.exit(1)
      }
      i++ // skip next arg
    } else if (args[i] === '--population' && i + 1 < args.length) {
      population = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--generations' && i + 1 < args.length) {
      generations = parseInt(args[i + 1], 10)
      i++
    } else if (args[i] === '--matches' && i + 1 < args.length) {
      matchesPerTeam = parseInt(args[i + 1], 10)
      i++
    } else {
      tokens.push(args[i])
    }
  }

  // First token is the command
  if (tokens.length > 0 && COMMANDS.has(tokens[0] as Command)) {
    command = tokens[0] as Command
    tokens.shift()
  }

  // Remaining tokens are the creature name (for creature command)
  if (tokens.length > 0) {
    creatureName = tokens.join(' ')
  }

  if (command === 'creature' && !creatureName) {
    console.error('Error: creature command requires a name argument')
    console.error('Usage: pnpm sim:creature "Tyrannosaurus Rex"')
    process.exit(1)
  }

  return { command, creatureName, trials, population, generations, matchesPerTeam, normalizeStats, noActives, noPassives, csv }
}

// ─── Stat Normalization ──────────────────────────────────────────

/** Scale all creatures to the same total stat budget, removing rarity advantage. */
function normalizeCreatures(creatures: Array<CreatureRecord>): Array<CreatureRecord> {
  const TARGET_TOTAL = 170 // rare-tier baseline — value doesn't matter, just needs to be equal

  return creatures.map((c) => {
    const total = c.hp + c.atk + c.def + c.spd
    if (total === 0) return c
    const scale = TARGET_TOTAL / total
    return {
      ...c,
      hp: Math.round(c.hp * scale),
      atk: Math.round(c.atk * scale),
      def: Math.round(c.def * scale),
      spd: Math.round(c.spd * scale),
    }
  })
}

// ─── Default Trial Counts ─────────────────────────────────────────

const DEFAULTS = {
  matchup: 100,
  team: 10_000,
  role: 1_000,
  creature: 100,
  ability: 10_000,
  meta: 25,
}

// ─── Main ─────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv)

  // In CSV mode, suppress decorative output (goes to stderr so piping works)
  const log = args.csv
    ? (...a: Array<unknown>) => console.error(...a)
    : console.log.bind(console)

  log(chalk.bold('\n  Paleo Waifu — Battle Simulator\n'))

  // Load creature data
  log('  Loading creature data...')
  const t0 = Date.now()
  let creatures = loadCreatures()
  log(`  Loaded ${creatures.length} battle-ready creatures`)

  if (args.normalizeStats) {
    creatures = normalizeCreatures(creatures)
    log(chalk.yellow('  ⚗ Stats normalized — all stats scaled to 170 total (rarity-neutral)'))
  }

  if (args.noActives) {
    creatures = creatures.map((c) => ({
      ...c,
      active: { templateId: 'bite', displayName: 'Bite' },
    }))
    log(chalk.yellow('  ⚗ Active abilities disabled — all creatures use Bite'))
  }

  if (args.noPassives) {
    creatures = creatures.map((c) => ({
      ...c,
      passive: { templateId: 'none', displayName: 'None' },
    }))
    log(chalk.yellow('  ⚗ Passive abilities disabled'))
  }
  log('')

  const run = (cmd: Command) => {
    const trials = args.trials

    switch (cmd) {
      case 'matchup':
        runMatchupReport(creatures, {
          trials: trials ?? DEFAULTS.matchup,
          csv: args.csv,
        })
        break
      case 'team':
        runTeamReport(creatures, {
          trials: trials ?? DEFAULTS.team,
          csv: args.csv,
        })
        break
      case 'role':
        runRoleReport(creatures, {
          trials: trials ?? DEFAULTS.role,
          csv: args.csv,
        })
        break
      case 'creature':
        runCreatureReport(creatures, {
          name: args.creatureName!,
          trials: trials ?? DEFAULTS.creature,
          csv: args.csv,
        })
        break
      case 'ability':
        runAbilityReport(creatures, {
          trials: trials ?? DEFAULTS.ability,
          csv: args.csv,
        })
        break
      case 'meta':
        runMetaReport(creatures, {
          population: args.population ?? 100,
          generations: trials ?? args.generations ?? DEFAULTS.meta,
          matchesPerTeam: args.matchesPerTeam ?? 20,
          eliteRate: 0.1,
          mutationRate: 0.8,
          csv: args.csv,
        })
        break
    }
  }

  if (args.command === 'all') {
    // Run all reports except creature (requires a name)
    const reports: Array<Command> = ['role', 'matchup', 'team', 'ability']
    for (const report of reports) {
      run(report)
    }
  } else {
    run(args.command)
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  log(chalk.dim(`  Completed in ${elapsed}s\n`))
}

main()
