import type { BattleReadyCreature } from './BattleCreatureSlot'

interface SynergyPreviewProps {
  creatures: Array<BattleReadyCreature | null>
}

interface SynergyInfo {
  kind: string
  label: string
  description: string
}

function computeSynergies(
  slots: Array<BattleReadyCreature | null>,
): Array<SynergyInfo> {
  const filled = slots.filter(Boolean) as Array<BattleReadyCreature>
  if (filled.length < 2) return []

  const synergies: Array<SynergyInfo> = []

  // Type synergy
  const typeCounts = new Map<string, number>()
  for (const c of filled) {
    if (c.type) typeCounts.set(c.type, (typeCounts.get(c.type) ?? 0) + 1)
  }
  for (const [type, count] of typeCounts) {
    if (count >= 3) {
      synergies.push({
        kind: 'type',
        label: `${type} (3)`,
        description: '+7% HP, +3% ATK to all',
      })
    } else if (count >= 2) {
      synergies.push({
        kind: 'type',
        label: `${type} (2)`,
        description: '+5% HP to matching',
      })
    }
  }

  // Era synergy
  const eraCounts = new Map<string, number>()
  for (const c of filled) {
    eraCounts.set(c.era, (eraCounts.get(c.era) ?? 0) + 1)
  }
  for (const [era, count] of eraCounts) {
    if (count >= 2) {
      synergies.push({
        kind: 'era',
        label: `${era} (${count})`,
        description: '+3% all stats',
      })
    }
  }

  // Diet synergy
  const diets = filled.map((c) => {
    const d = c.diet.toLowerCase()
    if (d.includes('carni') || d.includes('pisci')) return 'carnivore'
    if (d.includes('herbi')) return 'herbivore'
    return 'other'
  })
  const hasCarnivore = diets.includes('carnivore')
  const hasHerbivore = diets.includes('herbivore')
  const allCarnivore = diets.every((d) => d === 'carnivore')
  const allHerbivore = diets.every((d) => d === 'herbivore')

  if (allCarnivore && filled.length >= 2) {
    synergies.push({
      kind: 'diet',
      label: 'All Carnivore',
      description: '+10% ATK, +7% SPD',
    })
  } else if (allHerbivore && filled.length >= 2) {
    synergies.push({
      kind: 'diet',
      label: 'All Herbivore',
      description: '+10% DEF, +10% HP',
    })
  } else if (hasCarnivore && hasHerbivore) {
    synergies.push({
      kind: 'diet',
      label: 'Mixed Diet',
      description: '+12% SPD, +7% ATK',
    })
  }

  return synergies
}

export function SynergyPreview({ creatures }: SynergyPreviewProps) {
  const synergies = computeSynergies(creatures)

  if (synergies.length === 0) {
    return (
      <div className="text-xs text-muted-foreground/50">
        Add creatures to see synergies
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {synergies.map((s) => (
        <div
          key={s.label}
          className="rounded-md bg-amber-500/10 px-2 py-1 text-xs"
        >
          <span className="font-semibold text-amber-400">{s.label}</span>
          <span className="ml-1 text-muted-foreground">{s.description}</span>
        </div>
      ))}
    </div>
  )
}
