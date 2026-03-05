import type { BattleCreature, SynergyBonus } from './types'

function normalizeDiet(diet: string): string {
  if (diet === 'Herbivorous/omnivorous') return 'Herbivorous'
  return diet
}

export function calculateSynergies(
  team: Array<BattleCreature>,
): Array<SynergyBonus> {
  const bonuses: Array<SynergyBonus> = []

  // ── Type synergy ──
  const typeCounts = new Map<string, Array<BattleCreature>>()
  for (const c of team) {
    const list = typeCounts.get(c.type) ?? []
    list.push(c)
    typeCounts.set(c.type, list)
  }

  for (const [type, creatures] of typeCounts) {
    if (creatures.length === 3) {
      bonuses.push({
        kind: 'type',
        description: `3× ${type}: +7% HP, +3% ATK to all`,
        affectedCreatureIds: team.map((c) => c.id),
        statBonuses: { hp: 7, atk: 3 },
      })
    } else if (creatures.length === 2) {
      bonuses.push({
        kind: 'type',
        description: `2× ${type}: +5% HP`,
        affectedCreatureIds: creatures.map((c) => c.id),
        statBonuses: { hp: 5 },
      })
    }
  }

  // ── Era synergy ──
  const eraCounts = new Map<string, Array<BattleCreature>>()
  for (const c of team) {
    const list = eraCounts.get(c.era) ?? []
    list.push(c)
    eraCounts.set(c.era, list)
  }

  for (const [era, creatures] of eraCounts) {
    if (creatures.length === 3) {
      bonuses.push({
        kind: 'era',
        description: `3× ${era}: +3% all stats to all`,
        affectedCreatureIds: team.map((c) => c.id),
        statBonuses: { hp: 3, atk: 3, def: 3, spd: 3 },
      })
    } else if (creatures.length === 2) {
      bonuses.push({
        kind: 'era',
        description: `2× ${era}: +3% all stats`,
        affectedCreatureIds: creatures.map((c) => c.id),
        statBonuses: { hp: 3, atk: 3, def: 3, spd: 3 },
      })
    }
  }

  // ── Diet synergy ──
  const normalizedDiets = team.map((c) => normalizeDiet(c.diet))
  const allCarni = normalizedDiets.every((d) => d === 'Carnivorous')
  const allHerbi = normalizedDiets.every((d) => d === 'Herbivorous')
  const hasCarni = normalizedDiets.includes('Carnivorous')
  const hasHerbi = normalizedDiets.includes('Herbivorous')

  if (allCarni) {
    bonuses.push({
      kind: 'diet',
      description: 'All Carnivorous: +10% ATK, +7% SPD',
      affectedCreatureIds: team.map((c) => c.id),
      statBonuses: { atk: 10, spd: 7 },
    })
  } else if (allHerbi) {
    bonuses.push({
      kind: 'diet',
      description: 'All Herbivorous: +10% DEF, +10% HP',
      affectedCreatureIds: team.map((c) => c.id),
      statBonuses: { def: 10, hp: 10 },
    })
  } else if (hasCarni && hasHerbi) {
    bonuses.push({
      kind: 'diet',
      description:
        'Mixed (Carnivore + Herbivore): +12% SPD, +7% ATK',
      affectedCreatureIds: team.map((c) => c.id),
      statBonuses: { spd: 12, atk: 7 },
    })
  }

  return bonuses
}

export function applySynergies(
  team: Array<BattleCreature>,
  bonuses: Array<SynergyBonus>,
): void {
  for (const bonus of bonuses) {
    for (const creature of team) {
      if (!bonus.affectedCreatureIds.includes(creature.id))
        continue

      for (const [stat, percent] of Object.entries(
        bonus.statBonuses,
      )) {
        const pct = percent
        switch (stat) {
          case 'hp': {
            const hpBonus = Math.floor(
              creature.maxHp * (pct / 100),
            )
            creature.maxHp += hpBonus
            creature.currentHp += hpBonus
            break
          }
          case 'atk':
            creature.atk += Math.floor(
              creature.baseStats.atk * (pct / 100),
            )
            break
          case 'def':
            creature.def += Math.floor(
              creature.baseStats.def * (pct / 100),
            )
            break
          case 'spd':
            creature.spd += Math.floor(
              creature.baseStats.spd * (pct / 100),
            )
            break
        }
      }
    }
  }
}
