import { createFileRoute } from '@tanstack/react-router'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { createDb } from '@paleo-waifu/shared/db/client'
import { battleTeam, userCreature } from '@paleo-waifu/shared/db/schema'
import { getCfEnv } from '@/lib/env'
import { createAuth } from '@/lib/auth'
import { checkCsrfOrigin, jsonResponse } from '@/lib/utils'
import {
  deleteTeam,
  executeArenaBattle,
  executeFriendlyBattle,
  getTeams,
  setTeam,
} from '@/lib/battle'

const idField = z.string().min(1).max(50)

const teamSlot = z.object({
  userCreatureId: idField,
  row: z.enum(['front', 'back']),
})

const BattleBody = z.discriminatedUnion('action', [
  // Team management
  z.object({
    action: z.literal('set_team'),
    slot: z.enum(['offense', 'defense']),
    members: z.array(teamSlot).length(3),
  }),
  z.object({
    action: z.literal('delete_team'),
    slot: z.enum(['offense', 'defense']),
  }),
  // Arena attack
  z.object({
    action: z.literal('arena_attack'),
    defenderId: idField,
  }),
  // Friendly battle
  z.object({
    action: z.literal('friendly_attack'),
    defenderId: idField,
  }),
])

export const Route = createFileRoute('/api/battle')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const originError = checkCsrfOrigin(request)
        if (originError) return originError

        const cfEnv = getCfEnv()
        const auth = await createAuth(cfEnv)
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }

        let rawBody: unknown
        try {
          rawBody = await request.json()
        } catch {
          return jsonResponse({ error: 'Invalid JSON' }, 400)
        }
        const parsed = BattleBody.safeParse(rawBody)
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }
        const body = parsed.data
        const db = await createDb(cfEnv.DB)
        const userId = session.user.id

        // ── SET TEAM ──────────────────────────────────────────
        if (body.action === 'set_team') {
          // Validate unique creature species
          const ucIds = body.members.map((s) => s.userCreatureId)
          if (new Set(ucIds).size !== 3) {
            return jsonResponse(
              { error: 'All 3 team slots must be different creatures' },
              400,
            )
          }
          const ucRows = await db
            .select({ creatureId: userCreature.creatureId })
            .from(userCreature)
            .where(
              and(
                eq(userCreature.userId, userId),
                inArray(userCreature.id, ucIds),
              ),
            )
            .all()
          if (
            ucRows.length !== 3 ||
            new Set(ucRows.map((r) => r.creatureId)).size !== 3
          ) {
            return jsonResponse(
              { error: 'All 3 team slots must be different species' },
              400,
            )
          }

          const result = await setTeam(db, userId, body.slot, body.members)
          return jsonResponse(result)
        }

        // ── DELETE TEAM ───────────────────────────────────────
        if (body.action === 'delete_team') {
          const deleted = await deleteTeam(db, userId, body.slot)
          if (!deleted) {
            return jsonResponse({ error: 'Team not found' }, 404)
          }
          return jsonResponse({ success: true })
        }

        // ── ARENA ATTACK ─────────────────────────────────────
        if (body.action === 'arena_attack') {
          if (body.defenderId === userId) {
            return jsonResponse({ error: 'You cannot attack yourself' }, 400)
          }

          // Load attacker's offense team
          const teams = await getTeams(db, userId)
          if (!teams.offense) {
            return jsonResponse({ error: 'Set your offense team first' }, 400)
          }

          // Load defender's defense team
          const defenderTeamRow = await db
            .select({ members: battleTeam.members })
            .from(battleTeam)
            .where(
              and(
                eq(battleTeam.userId, body.defenderId),
                eq(battleTeam.slot, 'defense'),
              ),
            )
            .get()
          if (!defenderTeamRow) {
            return jsonResponse(
              { error: 'This player has no defense team set' },
              400,
            )
          }

          const defenderSlots = JSON.parse(defenderTeamRow.members)
          const result = await executeArenaBattle(
            db,
            userId,
            body.defenderId,
            teams.offense,
            defenderSlots,
          )

          if (!result.success) {
            return jsonResponse({ error: result.error }, 400)
          }
          return jsonResponse(result)
        }

        // ── FRIENDLY ATTACK ──────────────────────────────────
        // body.action === 'friendly_attack'
        if (body.defenderId === userId) {
          return jsonResponse({ error: 'You cannot battle yourself' }, 400)
        }

        const teams = await getTeams(db, userId)
        if (!teams.offense) {
          return jsonResponse({ error: 'Set your offense team first' }, 400)
        }

        const defenderTeamRow = await db
          .select({ members: battleTeam.members })
          .from(battleTeam)
          .where(
            and(
              eq(battleTeam.userId, body.defenderId),
              eq(battleTeam.slot, 'defense'),
            ),
          )
          .get()
        if (!defenderTeamRow) {
          return jsonResponse(
            { error: 'This player has no defense team set' },
            400,
          )
        }

        const defenderSlots = JSON.parse(defenderTeamRow.members)
        const result = await executeFriendlyBattle(
          db,
          userId,
          body.defenderId,
          teams.offense,
          defenderSlots,
        )

        if (!result.success) {
          return jsonResponse({ error: result.error }, 400)
        }
        return jsonResponse(result)
      },
    },
  },
})
