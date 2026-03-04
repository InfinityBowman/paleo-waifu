import chalk from 'chalk'
import { loadCreatures } from './db.ts'
import { runMatchupReport } from './reports/matchup.ts'
import { runTeamReport } from './reports/team.ts'
import { runRoleReport } from './reports/role.ts'
import { runCreatureReport } from './reports/creature.ts'
import { runAbilityReport } from './reports/ability.ts'

// ─── CLI Argument Parsing ─────────────────────────────────────────

type Command = 'all' | 'matchup' | 'team' | 'role' | 'creature' | 'ability'

const COMMANDS = new Set<Command>([
  'all',
  'matchup',
  'team',
  'role',
  'creature',
  'ability',
])

interface SimArgs {
  command: Command
  creatureName?: string
  trials?: number
  csv: boolean
}

function parseArgs(argv: string[]): SimArgs {
  const args = argv.slice(2)
  let command: Command = 'all'
  let creatureName: string | undefined
  let trials: number | undefined
  let csv = false

  const tokens: string[] = []

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--') continue // skip pnpm arg separator
    if (args[i] === '--csv') {
      csv = true
    } else if (args[i] === '--trials' && i + 1 < args.length) {
      trials = parseInt(args[i + 1]!, 10)
      if (isNaN(trials) || trials < 1) {
        console.error('Error: --trials must be a positive integer')
        process.exit(1)
      }
      i++ // skip next arg
    } else {
      tokens.push(args[i]!)
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

  return { command, creatureName, trials, csv }
}

// ─── Default Trial Counts ─────────────────────────────────────────

const DEFAULTS = {
  matchup: 100,
  team: 10_000,
  role: 1_000,
  creature: 100,
  ability: 10_000,
}

// ─── Main ─────────────────────────────────────────────────────────

function main(): void {
  const args = parseArgs(process.argv)

  // In CSV mode, suppress decorative output (goes to stderr so piping works)
  const log = args.csv
    ? (...a: unknown[]) => console.error(...a)
    : console.log.bind(console)

  log(chalk.bold('\n  Paleo Waifu — Battle Simulator\n'))

  // Load creature data
  log('  Loading creature data...')
  const t0 = Date.now()
  const creatures = loadCreatures()
  log(`  Loaded ${creatures.length} battle-ready creatures\n`)

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
    }
  }

  if (args.command === 'all') {
    // Run all reports except creature (requires a name)
    const reports: Command[] = ['role', 'matchup', 'team', 'ability']
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
