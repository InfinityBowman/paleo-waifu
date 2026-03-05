import { runTrials, summarizeTrials } from '../runner.ts'
import {
  createProgressBar,
  printHeader,
  printTable,
  winRateColor,
  writeCsvHeader,
  writeCsvRow,
} from '../report.ts'
import type { CreatureRecord } from '../db.ts'

const ROLES = ['striker', 'tank', 'support', 'bruiser']

export function runRoleReport(
  creatures: Array<CreatureRecord>,
  options: { trials: number; csv: boolean },
): void {
  if (!options.csv) {
    printHeader('ROLE VS ROLE EFFECTIVENESS MATRIX')
  }

  // Group by role, pick top 3 by total stats
  const byRole = new Map<string, Array<CreatureRecord>>()
  for (const role of ROLES) {
    const members = creatures
      .filter((c) => c.role === role)
      .sort(
        (a, b) =>
          b.hp + b.atk + b.def + b.spd -
          (a.hp + a.atk + a.def + a.spd),
      )
      .slice(0, 3)

    if (members.length >= 3) {
      byRole.set(role, members)
    } else if (!options.csv) {
      console.log(
        `  Warning: ${role} has only ${members.length} creatures, skipping`,
      )
    }
  }

  const activeRoles = ROLES.filter((r) => byRole.has(r))
  const totalPairs = activeRoles.length * activeRoles.length
  const bar = options.csv ? null : createProgressBar(totalPairs, 'Role pairs')

  // Build win rate matrix
  const matrix: Array<Array<number>> = []

  for (const atkRole of activeRoles) {
    const row: Array<number> = []
    const teamA = byRole.get(atkRole)! as [
      CreatureRecord,
      CreatureRecord,
      CreatureRecord,
    ]

    for (const defRole of activeRoles) {
      const teamB = byRole.get(defRole)! as [
        CreatureRecord,
        CreatureRecord,
        CreatureRecord,
      ]

      const results = runTrials(teamA, teamB, options.trials)
      const summary = summarizeTrials(results)
      row.push(summary.winRateA)
      bar?.increment()
    }

    matrix.push(row)
  }

  bar?.stop()

  if (options.csv) {
    writeCsvHeader(['attacker_role', 'defender_role', 'win_rate'])
    for (let i = 0; i < activeRoles.length; i++) {
      for (let j = 0; j < activeRoles.length; j++) {
        writeCsvRow([
          activeRoles[i],
          activeRoles[j],
          (matrix[i][j] * 100).toFixed(2),
        ])
      }
    }
    return
  }

  // Format and print
  const cells = matrix.map((row) => row.map((rate) => winRateColor(rate)))

  printTable(activeRoles, activeRoles, cells, {
    title: `(${options.trials} trials per pair, top 3 creatures per role)`,
  })

  // Print per-role average win rate
  console.log('Average win rates:')
  for (let i = 0; i < activeRoles.length; i++) {
    const row = matrix[i]
    const avg = row.reduce((a, b) => a + b, 0) / row.length
    const flag = avg < 0.4 ? ' !! LOW' : avg > 0.6 ? ' !! HIGH' : ''
    console.log(`  ${activeRoles[i]}: ${winRateColor(avg)}${flag}`)
  }
  console.log()
}
