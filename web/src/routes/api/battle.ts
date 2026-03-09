import { createFileRoute } from '@tanstack/react-router'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { createDb } from '@paleo-waifu/shared/db/client'
import {
  battleChallenge,
  battleTeamPreset,
  userCreature,
} from '@paleo-waifu/shared/db/schema'
import { getCfEnv } from '@/lib/env'
import { createAuth } from '@/lib/auth'
import { checkCsrfOrigin, jsonResponse } from '@/lib/utils'
import { createChallenge, resolveBattle, validateChallenge } from '@/lib/battle'

const idField = z.string().min(1).max(50)

const teamSlot = z.object({
  userCreatureId: idField,
  row: z.enum(['front', 'back']),
})

const BattleBody = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('challenge'),
    defenderId: idField,
    team: z.array(teamSlot).length(3),
  }),
  z.object({
    action: z.literal('accept'),
    challengeId: idField,
    team: z.array(teamSlot).length(3),
  }),
  z.object({ action: z.literal('decline'), challengeId: idField }),
  z.object({ action: z.literal('cancel'), challengeId: idField }),
  // Preset CRUD
  z.object({
    action: z.literal('save_preset'),
    name: z.string().min(1).max(50),
    members: z.array(teamSlot).length(3),
  }),
  z.object({
    action: z.literal('update_preset'),
    presetId: idField,
    name: z.string().min(1).max(50),
    members: z.array(teamSlot).length(3),
  }),
  z.object({ action: z.literal('delete_preset'), presetId: idField }),
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

        // ── CHALLENGE ─────────────────────────────────────────────
        if (body.action === 'challenge') {
          // Validate unique creature species (not just unique userCreatureIds)
          const ucIds = body.team.map((s) => s.userCreatureId)
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

          const error = await validateChallenge(db, userId, body.defenderId)
          if (error) return jsonResponse({ error }, 400)

          const result = await createChallenge(
            db,
            userId,
            body.defenderId,
            body.team,
          )
          return jsonResponse(result)
        }

        // ── ACCEPT ────────────────────────────────────────────────
        if (body.action === 'accept') {
          const ucIds = body.team.map((s) => s.userCreatureId)
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

          const result = await resolveBattle(
            db,
            body.challengeId,
            userId,
            body.team,
          )
          if (!result.success) {
            return jsonResponse({ error: result.error }, 400)
          }
          return jsonResponse({ battleId: result.battleId })
        }

        // ── DECLINE ───────────────────────────────────────────────
        if (body.action === 'decline') {
          const updated = await db
            .update(battleChallenge)
            .set({ status: 'declined' })
            .where(
              and(
                eq(battleChallenge.id, body.challengeId),
                eq(battleChallenge.defenderId, userId),
                eq(battleChallenge.status, 'pending'),
              ),
            )
            .returning({ id: battleChallenge.id })
          if (updated.length === 0) {
            return jsonResponse(
              { error: 'Challenge not found or not declinable' },
              404,
            )
          }
          return jsonResponse({ success: true })
        }

        // ── CANCEL ────────────────────────────────────────────────
        if (body.action === 'cancel') {
          const updated = await db
            .update(battleChallenge)
            .set({ status: 'cancelled' })
            .where(
              and(
                eq(battleChallenge.id, body.challengeId),
                eq(battleChallenge.challengerId, userId),
                eq(battleChallenge.status, 'pending'),
              ),
            )
            .returning({ id: battleChallenge.id })
          if (updated.length === 0) {
            return jsonResponse(
              { error: 'Challenge not found or not cancellable' },
              404,
            )
          }
          return jsonResponse({ success: true })
        }

        // ── SAVE PRESET ───────────────────────────────────────────
        if (body.action === 'save_preset') {
          // Enforce 10 preset cap
          const [capRow] = await db
            .select({ total: sql<number>`count(*)` })
            .from(battleTeamPreset)
            .where(eq(battleTeamPreset.userId, userId))
          if (capRow.total >= 10) {
            return jsonResponse(
              { error: 'You can have at most 10 team presets.' },
              400,
            )
          }

          const id = nanoid()
          await db.insert(battleTeamPreset).values({
            id,
            userId,
            name: body.name,
            members: JSON.stringify(body.members),
          })
          return jsonResponse({ id })
        }

        // ── UPDATE PRESET ─────────────────────────────────────────
        if (body.action === 'update_preset') {
          const updated = await db
            .update(battleTeamPreset)
            .set({
              name: body.name,
              members: JSON.stringify(body.members),
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(battleTeamPreset.id, body.presetId),
                eq(battleTeamPreset.userId, userId),
              ),
            )
            .returning({ id: battleTeamPreset.id })
          if (updated.length === 0) {
            return jsonResponse({ error: 'Preset not found' }, 404)
          }
          return jsonResponse({ success: true })
        }

        // ── DELETE PRESET ─────────────────────────────────────────
        // body.action === 'delete_preset' — last branch of discriminated union
        const deleted = await db
          .delete(battleTeamPreset)
          .where(
            and(
              eq(battleTeamPreset.id, body.presetId),
              eq(battleTeamPreset.userId, userId),
            ),
          )
          .returning({ id: battleTeamPreset.id })
        if (deleted.length === 0) {
          return jsonResponse({ error: 'Preset not found' }, 404)
        }
        return jsonResponse({ success: true })
      },
    },
  },
})
