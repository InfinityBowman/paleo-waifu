import type { CreatureRecord } from '../db.ts'

/**
 * Detect synergy labels from a 3-member team.
 * Used by both the meta sim and field sim.
 */
export function detectSynergies(
  members: [CreatureRecord, CreatureRecord, CreatureRecord],
): Array<string> {
  const labels: Array<string> = []

  const types = members.map((m) => m.type)
  const eras = members.map((m) => m.era)
  const diets = members.map((m) => {
    const d = m.diet
    return d === 'Herbivorous/omnivorous' ? 'Herbivorous' : d
  })

  // Type synergy
  const typeCounts = new Map<string, number>()
  for (const t of types) typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1)
  const maxType = Math.max(...typeCounts.values())
  if (maxType >= 3) labels.push('Type 3x')
  else if (maxType >= 2) labels.push('Type 2x')

  // Era synergy
  const eraCounts = new Map<string, number>()
  for (const e of eras) eraCounts.set(e, (eraCounts.get(e) ?? 0) + 1)
  const maxEra = Math.max(...eraCounts.values())
  if (maxEra >= 3) labels.push('Era 3x')
  else if (maxEra >= 2) labels.push('Era 2x')

  // Diet synergy
  const uniqueDiets = new Set(diets)
  if (uniqueDiets.size === 1 && uniqueDiets.has('Carnivorous'))
    labels.push('All Carnivore')
  else if (uniqueDiets.size === 1 && uniqueDiets.has('Herbivorous'))
    labels.push('All Herbivore')
  else if (uniqueDiets.has('Carnivorous') && uniqueDiets.has('Herbivorous'))
    labels.push('Mixed Diet')

  return labels
}
