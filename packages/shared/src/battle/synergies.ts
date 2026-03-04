import type { BattleCreature, SynergyBonus } from './types'

function normalizeDiet(diet: string): string {
  if (diet === 'Herbivorous/omnivorous') return 'Herbivorous'
  return diet
}

export function calculateSynergies(
  team: BattleCreature[],
): SynergyBonus[] {
  const bonuses: SynergyBonus[] = []

  // ── Type synergy ──
  const typeCounts = new Map<string, BattleCreature[]>()
  for (const c of team) {
    const list = typeCounts.get(c.type) ?? []
    list.push(c)
    typeCounts.set(c.type, list)
  }

  for (const [type, creatures] of typeCounts) {
    if (creatures.length === 3) {
      bonuses.push({
        kind: 'type',
        description: `3× ${type}: +15% HP, +10% ATK to all`,
        affectedCreatureIds: team.map((c) => c.id),
        statBonuses: { hp: 15, atk: 10 },
      })
    } else if (creatures.length === 2) {
      bonuses.push({
        kind: 'type',
        description: `2× ${type}: +10% HP`,
        affectedCreatureIds: creatures.map((c) => c.id),
        statBonuses: { hp: 10 },
      })
    }
  }

  // ── Era synergy ──
  const eraCounts = new Map<string, BattleCreature[]>()
  for (const c of team) {
    const list = eraCounts.get(c.era) ?? []
    list.push(c)
    eraCounts.set(c.era, list)
  }

  for (const [era, creatures] of eraCounts) {
    if (creatures.length === 3) {
      bonuses.push({
        kind: 'era',
        description: `3× ${era}: +10% all stats to all`,
        affectedCreatureIds: team.map((c) => c.id),
        statBonuses: { hp: 10, atk: 10, def: 10, spd: 10, abl: 10 },
      })
    } else if (creatures.length === 2) {
      bonuses.push({
        kind: 'era',
        description: `2× ${era}: +5% all stats`,
        affectedCreatureIds: creatures.map((c) => c.id),
        statBonuses: { hp: 5, atk: 5, def: 5, spd: 5, abl: 5 },
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
      description: 'All Carnivorous: +15% ATK',
      affectedCreatureIds: team.map((c) => c.id),
      statBonuses: { atk: 15 },
    })
  } else if (allHerbi) {
    bonuses.push({
      kind: 'diet',
      description: 'All Herbivorous: +20% DEF',
      affectedCreatureIds: team.map((c) => c.id),
      statBonuses: { def: 20 },
    })
  } else if (hasCarni && hasHerbi) {
    bonuses.push({
      kind: 'diet',
      description: 'Mixed (Carnivore + Herbivore): +10% SPD',
      affectedCreatureIds: team.map((c) => c.id),
      statBonuses: { spd: 10 },
    })
  }

  return bonuses
}

export function applySynergies(
  team: BattleCreature[],
  bonuses: SynergyBonus[],
): void {
  for (const bonus of bonuses) {
    for (const creature of team) {
      if (!bonus.affectedCreatureIds.includes(creature.id)) continue

      for (const [stat, percent] of Object.entries(bonus.statBonuses)) {
        const pct = percent as number
        switch (stat) {
          case 'hp': {
            const hpBonus = Math.floor(creature.maxHp * (pct / 100))
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
          case 'abl':
            creature.abl += Math.floor(
              creature.baseStats.abl * (pct / 100),
            )
            break
        }
      }
    }
  }
}
