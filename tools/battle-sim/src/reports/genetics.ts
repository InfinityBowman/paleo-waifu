import { assignRow } from '../runner.ts'
import { canonicalGenome, ensureFrontRow, genomeKey, resolveMembers } from './meta-utils.ts'
import type { CreatureRecord } from '../db.ts'
import type { CreatureSlot, Individual, TeamGenome } from './meta-types.ts'

export function mutate(
  parent: Individual,
  creatures: Array<CreatureRecord>,
  creatureIndex: Map<string, CreatureRecord>,
  generation: number,
): Individual {
  const newSlots = parent.genome.map((s) => ({ ...s })) as [
    CreatureSlot,
    CreatureSlot,
    CreatureSlot,
  ]

  if (Math.random() < 0.3) {
    // Row mutation: flip a random member's row
    const slotIdx = Math.floor(Math.random() * 3)
    newSlots[slotIdx].row = newSlots[slotIdx].row === 'front' ? 'back' : 'front'
  } else {
    // Creature mutation: replace a random member
    const slotIdx = Math.floor(Math.random() * 3)
    const existing = new Set(newSlots.map((s) => s.id))

    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = creatures[Math.floor(Math.random() * creatures.length)]
      if (!existing.has(candidate.id)) {
        newSlots[slotIdx] = {
          id: candidate.id,
          row: assignRow(candidate.role),
        }
        break
      }
    }
  }

  ensureFrontRow(newSlots)
  const genome = canonicalGenome(newSlots)
  return {
    genome,
    members: resolveMembers(genome, creatureIndex),
    fitness: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    generationBorn: generation,
  }
}

export function crossover(
  parentA: Individual,
  parentB: Individual,
  creatures: Array<CreatureRecord>,
  creatureIndex: Map<string, CreatureRecord>,
  generation: number,
): Individual {
  // Take 1 or 2 slots from parentA, fill rest from parentB
  const crossPoint = Math.random() < 0.5 ? 1 : 2
  const childSlots: Array<CreatureSlot> = parentA.genome
    .slice(0, crossPoint)
    .map((s) => ({ ...s }))
  const childSet = new Set(childSlots.map((s) => s.id))

  // Fill from parentB, skipping duplicates
  for (const slot of parentB.genome) {
    if (childSlots.length >= 3) break
    if (!childSet.has(slot.id)) {
      childSlots.push({ ...slot })
      childSet.add(slot.id)
    }
  }

  // If still not full (parents share creatures), fill from random pool
  for (let attempt = 0; attempt < 50 && childSlots.length < 3; attempt++) {
    const candidate = creatures[Math.floor(Math.random() * creatures.length)]
    if (!childSet.has(candidate.id)) {
      childSlots.push({
        id: candidate.id,
        row: assignRow(candidate.role),
      })
      childSet.add(candidate.id)
    }
  }

  // Fallback to parentA if crossover couldn't produce a full team
  if (childSlots.length < 3) {
    return mutate(parentA, creatures, creatureIndex, generation)
  }

  ensureFrontRow(childSlots)
  const genome = canonicalGenome(
    childSlots as [CreatureSlot, CreatureSlot, CreatureSlot],
  )
  return {
    genome,
    members: resolveMembers(genome, creatureIndex),
    fitness: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    generationBorn: generation,
  }
}

// ─── Selection & Reproduction (with Diversity Pressure) ──────────

export function selectAndReproduce(
  population: Array<Individual>,
  targetSize: number,
  creatures: Array<CreatureRecord>,
  creatureIndex: Map<string, CreatureRecord>,
  eliteRate: number,
  mutationRate: number,
  generation: number,
): Array<Individual> {
  // Sort by fitness descending
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness)

  const eliteCount = Math.ceil(targetSize * eliteRate)
  const survivorCount = Math.ceil(population.length / 2)
  const survivors = sorted.slice(0, survivorCount)

  const nextGen: Array<Individual> = []
  const seen = new Set<string>()

  // Elite pass-through (reset fitness but keep genome)
  for (let i = 0; i < eliteCount && i < survivors.length; i++) {
    const elite = survivors[i]
    const key = genomeKey(elite.genome)
    seen.add(key)
    nextGen.push({
      ...elite,
      fitness: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    })
  }

  // Fill remaining with offspring, rejecting duplicate genomes
  let attempts = 0
  const maxAttempts = (targetSize - nextGen.length) * 5

  while (nextGen.length < targetSize && attempts < maxAttempts) {
    attempts++
    const parentIdx = Math.floor(Math.random() * survivors.length)
    const parent = survivors[parentIdx]

    let child: Individual
    if (Math.random() < mutationRate) {
      child = mutate(parent, creatures, creatureIndex, generation)
    } else {
      const otherIdx = Math.floor(Math.random() * survivors.length)
      const other = survivors[otherIdx]
      child = crossover(parent, other, creatures, creatureIndex, generation)
    }

    const key = genomeKey(child.genome)
    if (!seen.has(key)) {
      seen.add(key)
      nextGen.push(child)
    }
  }

  // If couldn't fill due to convergence, allow duplicates with forced mutation
  while (nextGen.length < targetSize) {
    const parentIdx = Math.floor(Math.random() * survivors.length)
    const parent = survivors[parentIdx]
    nextGen.push(mutate(parent, creatures, creatureIndex, generation))
  }

  return nextGen
}
