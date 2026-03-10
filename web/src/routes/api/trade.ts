import { createFileRoute } from '@tanstack/react-router'
import { and, count, eq, inArray, ne } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { createDb } from '@paleo-waifu/shared/db/client'
import {
  battleTeam,
  tradeHistory,
  tradeOffer,
  tradeProposal,
  userCreature,
} from '@paleo-waifu/shared/db/schema'
import type { Database } from '@paleo-waifu/shared/db/client'
import { getCfEnv } from '@/lib/env'
import { createAuth } from '@/lib/auth'
import { checkCsrfOrigin, jsonResponse } from '@/lib/utils'

const idField = z.string().min(1).max(50)

/** Check if a creature is on any battle team (max 2 rows per user) */
async function isOnBattleTeam(
  db: Database,
  userId: string,
  userCreatureId: string,
) {
  const teams = await db
    .select({ members: battleTeam.members })
    .from(battleTeam)
    .where(eq(battleTeam.userId, userId))
    .all()
  for (const team of teams) {
    const members: Array<{ userCreatureId: string }> = JSON.parse(team.members)
    if (members.some((m) => m.userCreatureId === userCreatureId)) return true
  }
  return false
}

const TradeBody = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    offeredCreatureId: idField,
    wantedCreatureId: idField.optional(),
  }),
  z.object({ action: z.literal('cancel'), tradeId: idField }),
  z.object({
    action: z.literal('propose'),
    tradeId: idField,
    myCreatureId: idField,
  }),
  z.object({
    action: z.literal('confirm'),
    tradeId: idField,
    proposalId: idField,
  }),
  z.object({ action: z.literal('withdraw'), proposalId: idField }),
])

export const Route = createFileRoute('/api/trade')({
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
        const parsed = TradeBody.safeParse(rawBody)
        if (!parsed.success) {
          return jsonResponse({ error: 'Invalid request body' }, 400)
        }
        const body = parsed.data
        const db = await createDb(cfEnv.DB)
        const userId = session.user.id

        // ── CREATE ────────────────────────────────────────────────
        // Lock the offerer's creature immediately (one open trade per creature)
        if (body.action === 'create') {
          // Lock creature atomically — fails if not owned or already locked
          const locked = await db
            .update(userCreature)
            .set({ isLocked: true })
            .where(
              and(
                eq(userCreature.id, body.offeredCreatureId),
                eq(userCreature.userId, userId),
                eq(userCreature.isLocked, false),
              ),
            )
            .returning({ id: userCreature.id })

          if (locked.length === 0) {
            return jsonResponse(
              { error: 'Creature not found or already in a trade' },
              400,
            )
          }

          // Block creatures on battle teams
          if (await isOnBattleTeam(db, userId, body.offeredCreatureId)) {
            // Undo the lock
            await db
              .update(userCreature)
              .set({ isLocked: false })
              .where(eq(userCreature.id, body.offeredCreatureId))
            return jsonResponse(
              {
                error:
                  'This creature is on a battle team. Remove it from your team first.',
              },
              400,
            )
          }

          // Enforce 5-trade cap
          const [capRow] = await db
            .select({ total: count() })
            .from(tradeOffer)
            .where(
              and(
                eq(tradeOffer.offererId, userId),
                eq(tradeOffer.status, 'open'),
              ),
            )

          if (capRow.total >= 5) {
            // Undo the lock
            await db
              .update(userCreature)
              .set({ isLocked: false })
              .where(eq(userCreature.id, body.offeredCreatureId))
            return jsonResponse(
              {
                error:
                  'You already have 5 active trades. Cancel one to create another.',
              },
              400,
            )
          }

          const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60
          const expiresAt = new Date(
            (Math.floor(Date.now() / 1000) + SEVEN_DAYS_SECONDS) * 1000,
          )

          const id = nanoid()
          await db.insert(tradeOffer).values({
            id,
            offererId: userId,
            offeredCreatureId: body.offeredCreatureId,
            wantedCreatureId: body.wantedCreatureId ?? null,
            expiresAt,
          })

          return jsonResponse({ id })
        }

        // ── CANCEL ────────────────────────────────────────────────
        // Offerer cancels their trade — unlock offered creature + cancel all proposals
        if (body.action === 'cancel') {
          const trade = await db
            .select()
            .from(tradeOffer)
            .where(
              and(
                eq(tradeOffer.id, body.tradeId),
                eq(tradeOffer.offererId, userId),
                eq(tradeOffer.status, 'open'),
              ),
            )
            .get()

          if (!trade) {
            return jsonResponse(
              { error: 'Trade not found or not cancellable' },
              404,
            )
          }

          // Fetch all pending proposals to unlock their creatures
          const pendingProposals = await db
            .select({ proposerCreatureId: tradeProposal.proposerCreatureId })
            .from(tradeProposal)
            .where(
              and(
                eq(tradeProposal.tradeId, body.tradeId),
                eq(tradeProposal.status, 'pending'),
              ),
            )
            .all()

          const proposalCreatureIds = pendingProposals.map(
            (p) => p.proposerCreatureId,
          )

          await db.batch([
            db
              .update(tradeOffer)
              .set({ status: 'cancelled' })
              .where(eq(tradeOffer.id, body.tradeId)),
            db
              .update(userCreature)
              .set({ isLocked: false })
              .where(eq(userCreature.id, trade.offeredCreatureId)),
            // Cancel all pending proposals
            db
              .update(tradeProposal)
              .set({ status: 'cancelled' })
              .where(
                and(
                  eq(tradeProposal.tradeId, body.tradeId),
                  eq(tradeProposal.status, 'pending'),
                ),
              ),
            // Unlock all proposal creatures
            ...(proposalCreatureIds.length > 0
              ? [
                  db
                    .update(userCreature)
                    .set({ isLocked: false })
                    .where(inArray(userCreature.id, proposalCreatureIds)),
                ]
              : []),
          ])

          return jsonResponse({ success: true })
        }

        // ── PROPOSE ───────────────────────────────────────────────
        // Another user proposes a trade — locks their creature
        if (body.action === 'propose') {
          const trade = await db
            .select({
              offererId: tradeOffer.offererId,
              wantedCreatureId: tradeOffer.wantedCreatureId,
              status: tradeOffer.status,
            })
            .from(tradeOffer)
            .where(eq(tradeOffer.id, body.tradeId))
            .get()

          if (!trade || trade.status !== 'open') {
            return jsonResponse({ error: 'Trade not found or not open' }, 404)
          }

          if (trade.offererId === userId) {
            return jsonResponse(
              { error: 'You cannot propose on your own trade' },
              409,
            )
          }

          // Check for existing proposal by this user on this trade
          const existing = await db
            .select({ id: tradeProposal.id })
            .from(tradeProposal)
            .where(
              and(
                eq(tradeProposal.tradeId, body.tradeId),
                eq(tradeProposal.proposerId, userId),
                eq(tradeProposal.status, 'pending'),
              ),
            )
            .get()

          if (existing) {
            return jsonResponse(
              { error: 'You already have a pending proposal on this trade' },
              409,
            )
          }

          // Lock the proposer's creature
          const locked = await db
            .update(userCreature)
            .set({ isLocked: true })
            .where(
              and(
                eq(userCreature.id, body.myCreatureId),
                eq(userCreature.userId, userId),
                eq(userCreature.isLocked, false),
              ),
            )
            .returning({ id: userCreature.id })

          if (locked.length === 0) {
            return jsonResponse(
              { error: 'Your creature not found or already in use' },
              400,
            )
          }

          // Block creatures on battle teams
          if (await isOnBattleTeam(db, userId, body.myCreatureId)) {
            await db
              .update(userCreature)
              .set({ isLocked: false })
              .where(eq(userCreature.id, body.myCreatureId))
            return jsonResponse(
              {
                error:
                  'This creature is on a battle team. Remove it from your team first.',
              },
              400,
            )
          }

          // Validate wantedCreatureId constraint
          if (trade.wantedCreatureId) {
            const mySpecies = await db
              .select({ creatureId: userCreature.creatureId })
              .from(userCreature)
              .where(eq(userCreature.id, body.myCreatureId))
              .get()

            if (mySpecies?.creatureId !== trade.wantedCreatureId) {
              await db
                .update(userCreature)
                .set({ isLocked: false })
                .where(eq(userCreature.id, body.myCreatureId))
              return jsonResponse(
                { error: 'This trade requires a specific creature species' },
                400,
              )
            }
          }

          const id = nanoid()
          await db.insert(tradeProposal).values({
            id,
            tradeId: body.tradeId,
            proposerId: userId,
            proposerCreatureId: body.myCreatureId,
          })

          return jsonResponse({ id, success: true })
        }

        // ── CONFIRM ───────────────────────────────────────────────
        // Offerer picks a winning proposal and executes the swap
        if (body.action === 'confirm') {
          const trade = await db
            .select()
            .from(tradeOffer)
            .where(
              and(
                eq(tradeOffer.id, body.tradeId),
                eq(tradeOffer.offererId, userId),
                eq(tradeOffer.status, 'open'),
              ),
            )
            .get()

          if (!trade) {
            return jsonResponse({ error: 'Trade not found or not open' }, 404)
          }

          // Validate the winning proposal
          const proposal = await db
            .select()
            .from(tradeProposal)
            .where(
              and(
                eq(tradeProposal.id, body.proposalId),
                eq(tradeProposal.tradeId, body.tradeId),
                eq(tradeProposal.status, 'pending'),
              ),
            )
            .get()

          if (!proposal) {
            return jsonResponse(
              { error: 'Proposal not found or not pending' },
              404,
            )
          }

          // Verify proposer still owns their creature and it's locked
          const proposerOwns = await db
            .select({ id: userCreature.id })
            .from(userCreature)
            .where(
              and(
                eq(userCreature.id, proposal.proposerCreatureId),
                eq(userCreature.userId, proposal.proposerId),
                eq(userCreature.isLocked, true),
              ),
            )
            .get()

          if (!proposerOwns) {
            // Proposal creature no longer valid — cancel just this proposal
            await db
              .update(tradeProposal)
              .set({ status: 'cancelled' })
              .where(eq(tradeProposal.id, body.proposalId))
            return jsonResponse(
              { error: 'Proposer creature is no longer available' },
              409,
            )
          }

          // Verify offerer still owns their creature and it's locked
          const offererOwns = await db
            .select({ id: userCreature.id })
            .from(userCreature)
            .where(
              and(
                eq(userCreature.id, trade.offeredCreatureId),
                eq(userCreature.userId, trade.offererId),
                eq(userCreature.isLocked, true),
              ),
            )
            .get()

          if (!offererOwns) {
            // Integrity error — shouldn't happen since we locked on create
            return jsonResponse(
              { error: 'Trade integrity error — your creature is missing' },
              409,
            )
          }

          // Fetch all OTHER pending proposals so we can cancel + unlock them
          const losingProposals = await db
            .select({
              id: tradeProposal.id,
              proposerCreatureId: tradeProposal.proposerCreatureId,
            })
            .from(tradeProposal)
            .where(
              and(
                eq(tradeProposal.tradeId, body.tradeId),
                ne(tradeProposal.id, body.proposalId),
                eq(tradeProposal.status, 'pending'),
              ),
            )
            .all()

          const losingCreatureIds = losingProposals.map(
            (p) => p.proposerCreatureId,
          )
          const losingProposalIds = losingProposals.map((p) => p.id)

          // Execute the swap + settle all proposals atomically
          await db.batch([
            // Accept the trade
            db
              .update(tradeOffer)
              .set({
                status: 'accepted',
                receiverId: proposal.proposerId,
                receiverCreatureId: proposal.proposerCreatureId,
              })
              .where(eq(tradeOffer.id, body.tradeId)),
            // Accept the winning proposal
            db
              .update(tradeProposal)
              .set({ status: 'accepted' })
              .where(eq(tradeProposal.id, body.proposalId)),
            // Swap: offerer's creature → proposer
            db
              .update(userCreature)
              .set({ userId: proposal.proposerId, isLocked: false })
              .where(eq(userCreature.id, trade.offeredCreatureId)),
            // Swap: proposer's creature → offerer
            db
              .update(userCreature)
              .set({ userId: trade.offererId, isLocked: false })
              .where(eq(userCreature.id, proposal.proposerCreatureId)),
            // Record trade history
            db.insert(tradeHistory).values({
              id: nanoid(),
              tradeOfferId: body.tradeId,
              giverId: trade.offererId,
              receiverId: proposal.proposerId,
              givenCreatureId: trade.offeredCreatureId,
              receivedCreatureId: proposal.proposerCreatureId,
            }),
            // Cancel losing proposals
            ...(losingProposalIds.length > 0
              ? [
                  db
                    .update(tradeProposal)
                    .set({ status: 'cancelled' })
                    .where(inArray(tradeProposal.id, losingProposalIds)),
                ]
              : []),
            // Unlock losing creatures
            ...(losingCreatureIds.length > 0
              ? [
                  db
                    .update(userCreature)
                    .set({ isLocked: false })
                    .where(inArray(userCreature.id, losingCreatureIds)),
                ]
              : []),
          ])

          return jsonResponse({ success: true })
        }

        // ── WITHDRAW ──────────────────────────────────────────────
        // Proposer withdraws their own proposal — unlock their creature
        const proposal = await db
          .select()
          .from(tradeProposal)
          .where(
            and(
              eq(tradeProposal.id, body.proposalId),
              eq(tradeProposal.proposerId, userId),
              eq(tradeProposal.status, 'pending'),
            ),
          )
          .get()

        if (!proposal) {
          return jsonResponse(
            { error: 'Proposal not found or not pending' },
            404,
          )
        }

        await db.batch([
          db
            .update(tradeProposal)
            .set({ status: 'withdrawn' })
            .where(eq(tradeProposal.id, body.proposalId)),
          db
            .update(userCreature)
            .set({ isLocked: false })
            .where(eq(userCreature.id, proposal.proposerCreatureId)),
        ])

        return jsonResponse({ success: true })
      },
    },
  },
})
