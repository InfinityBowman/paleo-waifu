import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  ACTIVE_ABILITY_TEMPLATES,
  COMBAT_DAMAGE_SCALE,
  PASSIVE_ABILITY_TEMPLATES,
  RARITY_BASE_TOTALS,
  ROLE_DISTRIBUTIONS,
} from '@paleo-waifu/shared/battle/constants'
import { loadCreatures } from '../../../battle-sim/src/db.ts'
import { runMetaReport } from '../../../battle-sim/src/reports/meta.ts'
import type {
  ConstantsSnapshot,
  CreatureRecord,
  SimProgressEvent,
  SimRequest,
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
  request: SimRequest,
): Array<CreatureRecord> {
  const patchMap = new Map(request.creaturePatches.map((p) => [p.id, p]))

  let creatures = base
    .filter((c) => {
      const patch = patchMap.get(c.id)
      return !patch?.disabled
    })
    .map((c) => {
      const patch = patchMap.get(c.id)
      if (!patch) return c
      return {
        ...c,
        hp: patch.hp ?? c.hp,
        atk: patch.atk ?? c.atk,
        def: patch.def ?? c.def,
        spd: patch.spd ?? c.spd,
        active: patch.activeTemplateId
          ? { templateId: patch.activeTemplateId, displayName: patch.activeTemplateId }
          : c.active,
        passive: patch.passiveTemplateId
          ? { templateId: patch.passiveTemplateId, displayName: patch.passiveTemplateId }
          : c.passive,
      }
    })

  // If rarity totals or role distributions changed, recompute stats
  // for creatures that weren't individually patched
  if (request.constants.rarityBaseTotals || request.constants.roleDistributions) {
    const rarityTotals: Partial<Record<string, number>> = {
      ...RARITY_BASE_TOTALS,
      ...request.constants.rarityBaseTotals,
    }
    const roleDists: Partial<Record<string, { hp: number; atk: number; def: number; spd: number }>> = {
      ...Object.fromEntries(
        Object.entries(ROLE_DISTRIBUTIONS).map(([k, v]) => [k, { ...v }]),
      ),
      ...request.constants.roleDistributions,
    }

    creatures = creatures.map((c) => {
      const patch = patchMap.get(c.id)
      // Skip creatures with explicit stat overrides
      if (
        patch?.hp !== undefined ||
        patch?.atk !== undefined ||
        patch?.def !== undefined ||
        patch?.spd !== undefined
      ) return c

      const baseTotal = rarityTotals[c.rarity] ?? 170
      const dist = roleDists[c.role]
      if (!dist) return c

      // Recompute stats from role distribution ratios and rarity total
      return {
        ...c,
        hp: Math.round(baseTotal * dist.hp),
        atk: Math.round(baseTotal * dist.atk),
        def: Math.round(baseTotal * dist.def),
        spd: Math.round(baseTotal * dist.spd),
      }
    })
  }

  return creatures
}

// ─── Sim SSE Endpoint ────────────────────────────────────────────

app.post('/api/sim', async (c) => {
  const body: SimRequest = await c.req.json()
  const base = getCreatures()
  let creatures = applyOverrides(base, body)

  // Isolation transforms (same logic as battle-sim CLI)
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

  if (creatures.length < 3) {
    return c.json({ error: 'Need at least 3 enabled creatures' }, 400)
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: SimProgressEvent) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        )

      try {
        const { result, snapshots } = runMetaReport(creatures, {
          population: body.options.population,
          generations: body.options.generations,
          matchesPerTeam: body.options.matchesPerTeam,
          eliteRate: body.options.eliteRate,
          mutationRate: body.options.mutationRate,
          csv: false,
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

// ─── Start ───────────────────────────────────────────────────────

const port = 4300
serve({ fetch: app.fetch, port }, () => {
  console.log(`Balance UI API running on http://localhost:${port}`)
})
