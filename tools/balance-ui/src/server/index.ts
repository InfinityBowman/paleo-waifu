import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  ACTIVE_ABILITY_TEMPLATES,
  ALL_ABILITY_TEMPLATES,
  COMBAT_DAMAGE_SCALE,
  DEF_SCALING_CONSTANT,
  PASSIVE_ABILITY_TEMPLATES,
  RARITY_BASE_TOTALS,
  ROLE_DISTRIBUTIONS,
} from '@paleo-waifu/shared/battle/constants'
import { loadCreatures } from '../../../battle-sim/src/db.ts'
import { runMetaReport } from '../../../battle-sim/src/reports/meta.ts'
import { runFieldReport } from '../../../battle-sim/src/reports/field.ts'
import type { AbilityTemplate } from '@paleo-waifu/shared/battle/types'
import { buildTeamWithRows } from '../../../battle-sim/src/runner.ts'
import { simulateBattle } from '@paleo-waifu/shared/battle/engine'
import type {
  AbilityOverride,
  ConstantsOverride,
  ConstantsSnapshot,
  CreatureOverridePatch,
  CreatureRecord,
  FieldSimProgressEvent,
  FieldSimRequest,
  SimProgressEvent,
  SimRequest,
  TeamBattleProgressEvent,
  TeamBattleRequest,
  TeamBattleResult,
} from '../shared/types.ts'

const app = new Hono()

app.use(
  '/*',
  cors({
    origin: ['http://localhost:4400', 'http://localhost:4300'],
    credentials: true,
  }),
)

// ─── Module-scope cache ──────────────────────────────────────────

let cachedCreatures: Array<CreatureRecord> | null = null

function getCreatures(): Array<CreatureRecord> {
  if (!cachedCreatures) {
    cachedCreatures = loadCreatures()
  }
  return cachedCreatures
}

function getConstantsSnapshot(): ConstantsSnapshot {
  return {
    rarityBaseTotals: { ...RARITY_BASE_TOTALS },
    roleDistributions: Object.fromEntries(
      Object.entries(ROLE_DISTRIBUTIONS).map(([k, v]) => [k, { ...v }]),
    ),
    combatDamageScale: COMBAT_DAMAGE_SCALE,
    defScalingConstant: DEF_SCALING_CONSTANT,
    activeTemplates: ACTIVE_ABILITY_TEMPLATES,
    passiveTemplates: PASSIVE_ABILITY_TEMPLATES,
  }
}

// ─── Routes ──────────────────────────────────────────────────────

app.get('/api/creatures', (c) => {
  const creatures = getCreatures()
  return c.json({ creatures, constants: getConstantsSnapshot() })
})

app.get('/api/creatures/reload', (c) => {
  cachedCreatures = null
  const creatures = getCreatures()
  return c.json({ creatures, constants: getConstantsSnapshot() })
})

// ─── Apply Overrides ─────────────────────────────────────────────

function applyOverrides(
  base: Array<CreatureRecord>,
  request: Pick<SimRequest, 'creaturePatches' | 'constants'>,
): Array<CreatureRecord> {
  const patchMap = new Map(request.creaturePatches.map((p) => [p.id, p]))
  const { roleModifiers, rarityModifiers } = request.constants

  return base
    .filter((c) => {
      const patch = patchMap.get(c.id)
      return !patch?.disabled
    })
    .map((c) => {
      const patch = patchMap.get(c.id)

      // Start with DB stats (preserves per-creature variance)
      let hp = patch?.hp ?? c.hp
      let atk = patch?.atk ?? c.atk
      let def = patch?.def ?? c.def
      let spd = patch?.spd ?? c.spd

      // Skip multiplier adjustments for creatures with explicit stat overrides
      const hasStatPatch =
        patch?.hp !== undefined ||
        patch?.atk !== undefined ||
        patch?.def !== undefined ||
        patch?.spd !== undefined

      if (!hasStatPatch) {
        // Apply per-role stat multipliers (e.g. striker ATK +10% → multiply by 1.10)
        const roleMod = roleModifiers?.[c.role]
        if (roleMod) {
          hp = Math.round(hp * (1 + (roleMod.hp ?? 0)))
          atk = Math.round(atk * (1 + (roleMod.atk ?? 0)))
          def = Math.round(def * (1 + (roleMod.def ?? 0)))
          spd = Math.round(spd * (1 + (roleMod.spd ?? 0)))
        }

        // Apply per-rarity uniform scaling (e.g. common -5% → multiply all stats by 0.95)
        const rarityMod = rarityModifiers?.[c.rarity]
        if (rarityMod) {
          const scale = 1 + rarityMod
          hp = Math.round(hp * scale)
          atk = Math.round(atk * scale)
          def = Math.round(def * scale)
          spd = Math.round(spd * scale)
        }
      }

      return {
        ...c,
        hp: Math.max(1, hp),
        atk: Math.max(1, atk),
        def: Math.max(1, def),
        spd: Math.max(1, spd),
        active: patch?.activeTemplateId
          ? {
              templateId: patch.activeTemplateId,
              displayName: patch.activeTemplateId,
            }
          : c.active,
        passive: patch?.passiveTemplateId
          ? {
              templateId: patch.passiveTemplateId,
              displayName: patch.passiveTemplateId,
            }
          : c.passive,
      }
    })
}

// ─── Ability Override Support ────────────────────────────────────

function buildTemplateMap(
  overrides?: Record<string, AbilityOverride>,
): Map<string, AbilityTemplate> | undefined {
  if (!overrides || Object.keys(overrides).length === 0) return undefined

  const map = new Map<string, AbilityTemplate>(
    ALL_ABILITY_TEMPLATES.map((t) => [t.id, t]),
  )

  for (const [templateId, override] of Object.entries(overrides)) {
    const base = map.get(templateId)
    if (!base) continue

    // Deep-clone the template
    const patched: AbilityTemplate = {
      ...base,
      trigger: { ...base.trigger },
      effects: base.effects.map((e) => ({ ...e })),
    }

    // Apply cooldown override (only for onUse triggers)
    if (override.cooldown !== undefined && patched.trigger.type === 'onUse') {
      patched.trigger = { ...patched.trigger, cooldown: override.cooldown }
    }

    // Apply per-effect parameter overrides
    if (override.effectOverrides) {
      for (const [indexStr, params] of Object.entries(
        override.effectOverrides,
      )) {
        const idx = parseInt(indexStr, 10)
        if (idx < 0 || idx >= patched.effects.length) continue
        patched.effects[idx] = {
          ...patched.effects[idx],
          ...params,
        } as (typeof patched.effects)[number]
      }
    }

    map.set(templateId, patched)
  }

  return map
}

// ─── Shared Override Pipeline ────────────────────────────────────

function prepareCreatures(body: {
  creaturePatches: Array<CreatureOverridePatch>
  constants: ConstantsOverride
  options: {
    normalizeStats: boolean
    noActives: boolean
    noPassives: boolean
    syntheticMode: boolean
  }
}): {
  creatures: Array<CreatureRecord>
  templateMap: Map<string, AbilityTemplate> | undefined
} {
  const base = body.options.syntheticMode
    ? generateSyntheticCreatures()
    : getCreatures()

  let creatures = base
  if (body.options.normalizeStats) {
    const TARGET_TOTAL = 170
    creatures = creatures.map((cr) => {
      const total = cr.hp + cr.atk + cr.def + cr.spd
      if (total === 0) return cr
      const scale = TARGET_TOTAL / total
      return {
        ...cr,
        hp: Math.round(cr.hp * scale),
        atk: Math.round(cr.atk * scale),
        def: Math.round(cr.def * scale),
        spd: Math.round(cr.spd * scale),
      }
    })
  }

  creatures = applyOverrides(creatures, body)

  if (body.options.noActives) {
    creatures = creatures.map((cr) => ({
      ...cr,
      active: { templateId: 'bite', displayName: 'Bite' },
    }))
  }

  if (body.options.noPassives) {
    creatures = creatures.map((cr) => ({
      ...cr,
      passive: { templateId: 'none', displayName: 'None' },
    }))
  }

  if (body.options.syntheticMode) {
    console.log(`Synthetic mode: ${creatures.length} virtual creatures`)
  }

  const templateMap = buildTemplateMap(body.constants.abilityOverrides)

  return { creatures, templateMap }
}

// ─── Synthetic Creature Generator ────────────────────────────────

function generateSyntheticCreatures(): Array<CreatureRecord> {
  const BASELINE_TOTAL = 170 // "rare" equivalent
  const roles = Object.keys(ROLE_DISTRIBUTIONS)
  const actives = ACTIVE_ABILITY_TEMPLATES.filter((t) => t.id !== 'basic_attack')
  const passives = PASSIVE_ABILITY_TEMPLATES.filter((t) => t.id !== 'none')
  const creatures: Array<CreatureRecord> = []

  for (const role of roles) {
    const dist = ROLE_DISTRIBUTIONS[role as keyof typeof ROLE_DISTRIBUTIONS]
    const hp = Math.round(BASELINE_TOTAL * dist.hp)
    const atk = Math.round(BASELINE_TOTAL * dist.atk)
    const def = Math.round(BASELINE_TOTAL * dist.def)
    const spd = Math.round(BASELINE_TOTAL * dist.spd)

    for (const active of actives) {
      for (const passive of passives) {
        const id = `syn-${role}-${active.id}-${passive.id}`
        creatures.push({
          id,
          name: `${role}/${active.name}/${passive.name}`,
          era: 'Synthetic',
          diet: 'Omnivorous',
          rarity: 'rare',
          type: 'Synthetic',
          role,
          hp,
          atk,
          def,
          spd,
          active: { templateId: active.id, displayName: active.name },
          passive: { templateId: passive.id, displayName: passive.name },
        })
      }
    }
  }

  return creatures
}

// ─── Meta Sim SSE Endpoint ───────────────────────────────────────

app.post('/api/sim', async (c) => {
  const body: SimRequest = await c.req.json()
  const { creatures, templateMap } = prepareCreatures(body)

  if (creatures.length < 3) {
    return c.json({ error: 'Need at least 3 enabled creatures' }, 400)
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: SimProgressEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))

      try {
        const { result, snapshots } = runMetaReport(creatures, {
          population: body.options.population,
          generations: body.options.generations,
          matchesPerTeam: body.options.matchesPerTeam,
          eliteRate: body.options.eliteRate,
          mutationRate: body.options.mutationRate,
          csv: false,
          templateMap,
          damageScale: body.constants.combatDamageScale,
          defScaling: body.constants.defScalingConstant,
          basicAttackMultiplier: body.constants.basicAttackMultiplier,
          onGeneration: (gen, snap) => {
            send({
              type: 'generation',
              generation: gen,
              total: body.options.generations,
              topFitness: snap.topFitness,
              avgFitness: snap.avgFitness,
            })
          },
        })
        send({ type: 'done', result: { result, snapshots } })
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
})

// ─── Field Sim SSE Endpoint ─────────────────────────────────────

app.post('/api/field-sim', async (c) => {
  const body: FieldSimRequest = await c.req.json()
  const { creatures, templateMap } = prepareCreatures(body)

  if (creatures.length < 2) {
    return c.json({ error: 'Need at least 2 enabled creatures' }, 400)
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: FieldSimProgressEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))

      try {
        const fieldResult = runFieldReport(creatures, {
          trialsPerPair: body.options.trialsPerPair,
          teamSampleSize: body.options.teamSampleSize,
          teamMatchCount: body.options.teamMatchCount,
          csv: false,
          templateMap,
          damageScale: body.constants.combatDamageScale,
          defScaling: body.constants.defScalingConstant,
          basicAttackMultiplier: body.constants.basicAttackMultiplier,
          onProgress: (phase, completed, total) => {
            send({ type: 'progress', phase, completed, total })
          },
        })
        send({ type: 'done', result: fieldResult })
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
})

// ─── Team Battle Endpoint ────────────────────────────────────────

app.post('/api/battle', async (c) => {
  const body: TeamBattleRequest = await c.req.json()
  const { creatures, templateMap } = prepareCreatures(body)

  const creatureMap = new Map(creatures.map((cr) => [cr.id, cr]))

  // Resolve team members
  const resolveTeam = (
    slots: TeamBattleRequest['teamA'],
  ): [CreatureRecord, CreatureRecord, CreatureRecord] | null => {
    const members = slots.map((s) => creatureMap.get(s.creatureId))
    if (members.some((m) => !m)) return null
    return members as [CreatureRecord, CreatureRecord, CreatureRecord]
  }

  const teamAMembers = resolveTeam(body.teamA)
  const teamBMembers = resolveTeam(body.teamB)

  if (!teamAMembers || !teamBMembers) {
    return c.json({ error: 'One or more creatures not found' }, 400)
  }

  const rowsA = body.teamA.map((s) => s.row) as ['front' | 'back', 'front' | 'back', 'front' | 'back']
  const rowsB = body.teamB.map((s) => s.row) as ['front' | 'back', 'front' | 'back', 'front' | 'back']

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: TeamBattleProgressEvent) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))

      try {
        const trials: TeamBattleResult['trials'] = []
        let winsA = 0
        let winsB = 0
        let draws = 0
        let totalTurns = 0

        for (let i = 1; i <= body.trials; i++) {
          const teamA = body.randomizeRows
            ? buildTeamWithRows(
                teamAMembers,
                rowsA.map(() => (Math.random() < 0.5 ? 'front' : 'back')) as ['front' | 'back', 'front' | 'back', 'front' | 'back'],
                templateMap,
              )
            : buildTeamWithRows(teamAMembers, rowsA, templateMap)

          const teamB = body.randomizeRows
            ? buildTeamWithRows(
                teamBMembers,
                rowsB.map(() => (Math.random() < 0.5 ? 'front' : 'back')) as ['front' | 'back', 'front' | 'back', 'front' | 'back'],
                templateMap,
              )
            : buildTeamWithRows(teamBMembers, rowsB, templateMap)

          const result = simulateBattle(teamA, teamB, {
            seed: i,
            damageScale: body.constants.combatDamageScale,
            defScaling: body.constants.defScalingConstant,
            basicAttackMultiplier: body.constants.basicAttackMultiplier,
          })

          const trial = {
            trial: i,
            winner: result.winner,
            turns: result.turns,
            teamAHpPercent: result.teamAHpPercent,
            teamBHpPercent: result.teamBHpPercent,
          }
          trials.push(trial)

          if (result.winner === 'A') winsA++
          else if (result.winner === 'B') winsB++
          else draws++
          totalTurns += result.turns

          send({ type: 'trial', trial: i, total: body.trials, winner: result.winner })
        }

        const total = trials.length || 1
        send({
          type: 'done',
          result: {
            trials,
            winsA,
            winsB,
            draws,
            winRateA: winsA / total,
            winRateB: winsB / total,
            avgTurns: totalTurns / total,
          },
        })
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
})

// ─── Start ───────────────────────────────────────────────────────

const port = 4300
serve({ fetch: app.fetch, port }, () => {
  console.log(`Balance UI API running on http://localhost:${port}`)
})
