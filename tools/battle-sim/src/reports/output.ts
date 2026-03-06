import {
  printHeader,
  printRankedList,
  printStatBlock,
  printSubheader,
  rarityColor,
  roleColor,
  winRateColor,
  writeCsvHeader,
  writeCsvRow,
} from '../report.ts'
import type { GenerationSnapshot, MetaOptions, MetaResult } from './meta-types.ts'

export function renderTerminal(
  result: MetaResult,
  snapshots: Array<GenerationSnapshot>,
  options: MetaOptions,
): void {
  printHeader('GENERATIONAL META EVOLUTION')

  const totalBattles =
    options.population * options.matchesPerTeam * options.generations
  const overallAvgTurns =
    snapshots.length > 0
      ? snapshots.reduce((sum, s) => sum + s.avgTurns, 0) / snapshots.length
      : 0
  printStatBlock({
    Population: options.population,
    Generations: options.generations,
    'Rounds / team': options.matchesPerTeam,
    'Games / team': `${options.matchesPerTeam * 2} (both sides)`,
    'Elite rate': `${(options.eliteRate * 100).toFixed(0)}%`,
    'Mutation rate': `${(options.mutationRate * 100).toFixed(0)}%`,
    'Total battles': totalBattles.toLocaleString(),
    'Avg turns / match': overallAvgTurns.toFixed(1),
    Pairing: 'Swiss (strength-matched)',
    'Row evolution': 'Enabled',
  })

  // Generation progression
  printSubheader('FITNESS PROGRESSION')

  // Show every generation if <=15, otherwise sample evenly
  const displaySnaps =
    snapshots.length <= 15
      ? snapshots
      : (() => {
          const picks: Array<GenerationSnapshot> = [snapshots[0]]
          const step = (snapshots.length - 1) / 9
          for (let i = 1; i < 10; i++) {
            picks.push(snapshots[Math.round(i * step)])
          }
          if (picks[picks.length - 1] !== snapshots[snapshots.length - 1]) {
            picks.push(snapshots[snapshots.length - 1])
          }
          return picks
        })()

  printRankedList(
    [
      { header: 'Gen' },
      { header: 'Top Fit' },
      { header: 'Avg Fit' },
      { header: 'Avg Turns' },
      { header: 'Diversity' },
      { header: 'Top Team' },
    ],
    displaySnaps.map((s) => [
      String(s.generation),
      winRateColor(s.topFitness),
      winRateColor(s.avgFitness),
      s.avgTurns.toFixed(1),
      `${((s.uniqueGenomes / options.population) * 100).toFixed(0)}%`,
      s.topTeamNames.join(', '),
    ]),
  )

  // Hall of Fame
  printSubheader('HALL OF FAME (top 10 teams)')
  printRankedList(
    [
      { header: 'Members' },
      { header: 'Rarities' },
      { header: 'Roles' },
      { header: 'Rows' },
      { header: 'Peak Fitness' },
    ],
    result.hallOfFame.map((ind) => [
      ind.members.map((m) => m.name).join(', '),
      ind.members.map((m) => rarityColor(m.rarity)).join(', '),
      ind.members.map((m) => roleColor(m.role)).join(', '),
      ind.genome.map((s) => (s.row === 'front' ? 'F' : 'B')).join('/'),
      winRateColor(ind.fitness),
    ]),
  )

  // Role distribution
  printSubheader('META ROLE DISTRIBUTION (top-quartile teams)')
  const roleRows = Object.entries(result.roleMetaShare)
    .sort((a, b) => b[1] - a[1])
    .map(([role, share]) => [roleColor(role), `${(share * 100).toFixed(1)}%`])

  printRankedList([{ header: 'Role' }, { header: 'Share' }], roleRows)

  // Formation distribution
  printSubheader('META FORMATION DISTRIBUTION (top-quartile teams)')
  const formRows = Object.entries(result.formationMetaShare)
    .sort((a, b) => b[1] - a[1])
    .map(([form, share]) => [form, `${(share * 100).toFixed(1)}%`])

  printRankedList([{ header: 'Formation' }, { header: 'Share' }], formRows)

  // Top creatures
  printSubheader('TOP CREATURES (by meta presence)')
  printRankedList(
    [
      { header: 'Creature' },
      { header: 'Rarity' },
      { header: 'Role' },
      { header: 'Appearances' },
    ],
    result.creatureLeaderboard
      .slice(0, 20)
      .map((c) => [
        c.creature.name,
        rarityColor(c.creature.rarity),
        roleColor(c.creature.role),
        String(c.appearances),
      ]),
  )

  // Ability leaderboard
  printSubheader('META ABILITY PRESENCE (active)')
  const activeAbilities = result.abilityLeaderboard
    .filter((a) => a.abilityType === 'active')
    .slice(0, 15)

  printRankedList(
    [{ header: 'Ability' }, { header: 'Appearances' }],
    activeAbilities.map((a) => [a.name, String(a.appearances)]),
  )

  printSubheader('META ABILITY PRESENCE (passive)')
  const passiveAbilities = result.abilityLeaderboard
    .filter((a) => a.abilityType === 'passive')
    .slice(0, 10)

  printRankedList(
    [{ header: 'Passive' }, { header: 'Appearances' }],
    passiveAbilities.map((a) => [a.name, String(a.appearances)]),
  )

  // Synergy presence
  printSubheader('META SYNERGY PRESENCE')
  const synergyRows = Object.entries(result.synergyMetaShare)
    .sort((a, b) => b[1] - a[1])
    .map(([syn, share]) => [syn, `${(share * 100).toFixed(1)}%`])

  printRankedList([{ header: 'Synergy' }, { header: 'Presence' }], synergyRows)
}

export function renderCsv(
  result: MetaResult,
  snapshots: Array<GenerationSnapshot>,
): void {
  // Generation progression
  writeCsvHeader([
    'section',
    'generation',
    'top_fitness',
    'avg_fitness',
    'avg_turns',
    'unique_genomes',
    'member1',
    'member2',
    'member3',
    'row1',
    'row2',
    'row3',
  ])
  for (const s of snapshots) {
    writeCsvRow([
      'generation',
      s.generation,
      (s.topFitness * 100).toFixed(2),
      (s.avgFitness * 100).toFixed(2),
      s.avgTurns.toFixed(1),
      s.uniqueGenomes,
      s.topTeamNames[0],
      s.topTeamNames[1],
      s.topTeamNames[2],
      s.topTeamRows[0],
      s.topTeamRows[1],
      s.topTeamRows[2],
    ])
  }

  // Hall of fame
  writeCsvHeader([
    'section',
    'rank',
    'member1',
    'member2',
    'member3',
    'rarity1',
    'rarity2',
    'rarity3',
    'row1',
    'row2',
    'row3',
    'peak_fitness',
  ])
  for (const [i, ind] of result.hallOfFame.entries()) {
    writeCsvRow([
      'hall_of_fame',
      i + 1,
      ind.members[0].name,
      ind.members[1].name,
      ind.members[2].name,
      ind.members[0].rarity,
      ind.members[1].rarity,
      ind.members[2].rarity,
      ind.genome[0].row,
      ind.genome[1].row,
      ind.genome[2].row,
      (ind.fitness * 100).toFixed(2),
    ])
  }

  // Role share
  writeCsvHeader(['section', 'role', 'meta_share_pct'])
  for (const [role, share] of Object.entries(result.roleMetaShare)) {
    writeCsvRow(['role_share', role, (share * 100).toFixed(2)])
  }

  // Formation share
  writeCsvHeader(['section', 'formation', 'meta_share_pct'])
  for (const [form, share] of Object.entries(result.formationMetaShare)) {
    writeCsvRow(['formation_share', form, (share * 100).toFixed(2)])
  }

  // Ability leaderboard
  writeCsvHeader(['section', 'template_id', 'name', 'type', 'appearances'])
  for (const a of result.abilityLeaderboard) {
    writeCsvRow(['ability', a.templateId, a.name, a.abilityType, a.appearances])
  }

  // Creature leaderboard
  writeCsvHeader([
    'section',
    'name',
    'rarity',
    'role',
    'type',
    'diet',
    'era',
    'appearances',
    'avg_fitness',
  ])
  for (const c of result.creatureLeaderboard) {
    writeCsvRow([
      'creature',
      c.creature.name,
      c.creature.rarity,
      c.creature.role,
      c.creature.type,
      c.creature.diet,
      c.creature.era,
      c.appearances,
      (c.avgFitness * 100).toFixed(2),
    ])
  }

  // Synergy share
  writeCsvHeader(['section', 'synergy', 'meta_share_pct'])
  for (const [syn, share] of Object.entries(result.synergyMetaShare)) {
    writeCsvRow(['synergy', syn, (share * 100).toFixed(2)])
  }
}
