import type { Row } from '@paleo-waifu/shared/battle/types'
import type { CreatureRecord } from '../db.ts'
import type { CreatureSlot, TeamGenome } from './meta-types.ts'

export function canonicalGenome(slots: Array<CreatureSlot>): TeamGenome {
  return [...slots].sort((a, b) => a.id.localeCompare(b.id)) as TeamGenome
}

export function genomeKey(g: TeamGenome): string {
  return g.map((s) => `${s.id}:${s.row}`).join('|')
}

export function getRows(g: TeamGenome): [Row, Row, Row] {
  return [g[0].row, g[1].row, g[2].row]
}

export function ensureMixedRows(slots: Array<CreatureSlot>): void {
  if (!slots.some((s) => s.row === 'front')) {
    slots[0].row = 'front'
  } else if (!slots.some((s) => s.row === 'back')) {
    slots[slots.length - 1].row = 'back'
  }
}

export function resolveMembers(
  genome: TeamGenome,
  index: Map<string, CreatureRecord>,
): [CreatureRecord, CreatureRecord, CreatureRecord] {
  return genome.map((slot) => index.get(slot.id)!) as [
    CreatureRecord,
    CreatureRecord,
    CreatureRecord,
  ]
}
