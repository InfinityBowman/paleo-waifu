import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { loadCreatures } from '../../../battle-sim/src/db.ts'
import { runMetaReport } from '../../../battle-sim/src/reports/meta.ts'
import {
  RARITY_BASE_TOTALS,
  ROLE_DISTRIBUTIONS,
  COMBAT_DAMAGE_SCALE,
  ACTIVE_ABILITY_TEMPLATES,
  PASSIVE_ABILITY_TEMPLATES,
} from '@paleo-waifu/shared/battle/constants'
import type {
  CreatureRecord,
  SimRequest,
  SimProgressEvent,
  ConstantsSnapshot,
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

let cachedCreatures: CreatureRecord[] | null = null

function getCreatures(): CreatureRecord[] {
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
  base: CreatureRecord[],
  request: SimRequest,
): CreatureRecord[] {
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
    const rarityTotals = {
      ...RARITY_BASE_TOTALS,
      ...request.constants.rarityBaseTotals,
    }
    const roleDists = {
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

      const baseTotal = rarityTotals[c.rarity] ?? RARITY_BASE_TOTALS[c.rarity] ?? 170
      const dist = roleDists[c.role] ?? ROLE_DISTRIBUTIONS[c.role as keyof typeof ROLE_DISTRIBUTIONS]
      if (!dist) return c

      // Recompute stats preserving the creature's original variance
      const origTotal = c.hp + c.atk + c.def + c.spd
      const newTotal = baseTotal
      if (origTotal === 0) return c

      const scale = newTotal / origTotal
      return {
        ...c,
        hp: Math.round(c.hp * scale),
        atk: Math.round(c.atk * scale),
        def: Math.round(c.def * scale),
        spd: Math.round(c.spd * scale),
      }
    })
  }

  return creatures
}

// ─── Sim SSE Endpoint ────────────────────────────────────────────

app.post('/api/sim', async (c) => {
  const body = (await c.req.json()) as SimRequest
  const base = getCreatures()
  const creatures = applyOverrides(base, body)

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
          eliteRate: 0.1,
          mutationRate: 0.8,
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
