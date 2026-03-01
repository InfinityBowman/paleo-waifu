import { createFileRoute } from '@tanstack/react-router'
import { and, count, eq, inArray, ne, or } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { z } from 'zod'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@/lib/db/client'
import { createAuth } from '@/lib/auth'
import { tradeHistory, tradeOffer, userCreature } from '@/lib/db/schema'
import { checkCsrfOrigin, jsonResponse } from '@/lib/utils'

const idField = z.string().min(1).max(50)

const TradeBody = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    offeredCreatureId: idField,
    wantedCreatureId: idField.optional(),
  }),
  z.object({ action: z.literal('cancel'), tradeId: idField }),
  z.object({
    action: z.literal('accept'),
    tradeId: idField,
    myCreatureId: idField,
  }),
  z.object({ action: z.literal('confirm'), tradeId: idField }),
  z.object({ action: z.literal('reject'), tradeId: idField }),
  z.object({ action: z.literal('withdraw'), tradeId: idField }),
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

        async function resetPendingTrade(
          tradeId: string,
          userField: 'offererId' | 'receiverId',
        ): Promise<Response | null> {
          const trade = await db
            .select()
            .from(tradeOffer)
            .where(
              and(
                eq(tradeOffer.id, tradeId),
                eq(tradeOffer[userField], userId),
                eq(tradeOffer.status, 'pending'),
              ),
            )
            .get()

          if (!trade) {
            return jsonResponse(
              { error: 'Trade not found or not pending' },
              404,
            )
          }

          const resetOp = db
            .update(tradeOffer)
            .set({
              status: 'open',
              receiverId: null,
              receiverCreatureId: null,
            })
            .where(eq(tradeOffer.id, tradeId))

          if (trade.receiverCreatureId) {
            await db.batch([
              db
                .update(userCreature)
                .set({ isLocked: false })
                .where(eq(userCreature.id, trade.receiverCreatureId)),
              resetOp,
            ])
          } else {
            await resetOp
          }

          return null
        }

        // Create trade offer
        if (body.action === 'create') {
          // Validate creature exists, belongs to user, and is not locked
          // (locked = committed as receiver on another pending trade)
          // No lock on create — the same creature can be in multiple open trades
          const owned = await db
            .select({ id: userCreature.id })
            .from(userCreature)
            .where(
              and(
                eq(userCreature.id, body.offeredCreatureId),
                eq(userCreature.userId, userId),
                eq(userCreature.isLocked, false),
              ),
            )
            .get()

          if (!owned) {
            return jsonResponse({ error: 'Creature not found or locked' }, 400)
          }

          // Enforce 5-trade cap
          const [capRow] = await db
            .select({ total: count() })
            .from(tradeOffer)
            .where(
              and(
                eq(tradeOffer.offererId, userId),
                inArray(tradeOffer.status, ['open', 'pending']),
              ),
            )

          if (capRow.total >= 5) {
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

        // Cancel trade (offerer only, from open or pending)
        if (body.action === 'cancel') {
          const trade = await db
            .select()
            .from(tradeOffer)
            .where(
              and(
                eq(tradeOffer.id, body.tradeId),
                eq(tradeOffer.offererId, userId),
              ),
            )
            .get()

          if (
            !trade ||
            (trade.status !== 'open' && trade.status !== 'pending')
          ) {
            return jsonResponse(
              { error: 'Trade not found or not cancellable' },
              404,
            )
          }

          // If pending, unlock receiver's creature + cancel in one batch
          // If open, just cancel — offerer's creature was never locked
          if (trade.status === 'pending' && trade.receiverCreatureId) {
            await db.batch([
              db
                .update(userCreature)
                .set({ isLocked: false })
                .where(eq(userCreature.id, trade.receiverCreatureId)),
              db
                .update(tradeOffer)
                .set({ status: 'cancelled' })
                .where(eq(tradeOffer.id, body.tradeId)),
            ])
          } else {
            await db
              .update(tradeOffer)
              .set({ status: 'cancelled' })
              .where(eq(tradeOffer.id, body.tradeId))
          }

          return jsonResponse({ success: true })
        }

        // Propose to accept (sets trade to pending — offerer must confirm)
        if (body.action === 'accept') {
          // Fetch trade FIRST to validate before locking anything
          const trade = await db
            .select({
              offeredCreatureId: tradeOffer.offeredCreatureId,
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
              { error: 'You cannot accept your own trade' },
              409,
            )
          }

          // Validate offerer's creature is still available (owned + not locked)
          // UX guard to prevent accepting a trade that can never be confirmed
          const offererCreature = await db
            .select({ id: userCreature.id })
            .from(userCreature)
            .where(
              and(
                eq(userCreature.id, trade.offeredCreatureId),
                eq(userCreature.userId, trade.offererId),
                eq(userCreature.isLocked, false),
              ),
            )
            .get()

          if (!offererCreature) {
            return jsonResponse(
              { error: "Offerer's creature is no longer available" },
              409,
            )
          }

          // Lock the acceptor's creature — verify ownership before touching the trade
          const myLocked = await db
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

          if (myLocked.length === 0) {
            return jsonResponse(
              { error: 'Your creature not found or locked' },
              400,
            )
          }

          // Validate wantedCreatureId constraint if the trade specifies one
          if (trade.wantedCreatureId) {
            const mySpecies = await db
              .select({ creatureId: userCreature.creatureId })
              .from(userCreature)
              .where(eq(userCreature.id, body.myCreatureId))
              .get()

            if (mySpecies?.creatureId !== trade.wantedCreatureId) {
              // Unlock the creature we just locked
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

          // Now atomically claim the trade as pending — prevents double-propose
          const claimed = await db
            .update(tradeOffer)
            .set({
              status: 'pending',
              receiverId: userId,
              receiverCreatureId: body.myCreatureId,
            })
            .where(
              and(
                eq(tradeOffer.id, body.tradeId),
                eq(tradeOffer.status, 'open'),
                ne(tradeOffer.offererId, userId),
              ),
            )
            .returning()

          if (claimed.length === 0) {
            // Undo the lock since we couldn't claim the trade
            await db
              .update(userCreature)
              .set({ isLocked: false })
              .where(eq(userCreature.id, body.myCreatureId))
            return jsonResponse(
              {
                error:
                  'Trade not found, not open, or you cannot accept your own trade',
              },
              409,
            )
          }

          return jsonResponse({ success: true, status: 'pending' })
        }

        // Offerer confirms a pending trade — executes the swap
        if (body.action === 'confirm') {
          // Only the offerer can confirm, and only pending trades
          const trade = await db
            .select()
            .from(tradeOffer)
            .where(
              and(
                eq(tradeOffer.id, body.tradeId),
                eq(tradeOffer.offererId, userId),
                eq(tradeOffer.status, 'pending'),
              ),
            )
            .get()

          if (!trade || !trade.receiverId || !trade.receiverCreatureId) {
            return jsonResponse(
              { error: 'Trade not found or not pending' },
              404,
            )
          }

          // Atomic lock of offerer's creature — this is the serialization point
          // Prevents two confirms from racing for the same creature
          const locked = await db
            .update(userCreature)
            .set({ isLocked: true })
            .where(
              and(
                eq(userCreature.id, trade.offeredCreatureId),
                eq(userCreature.userId, trade.offererId),
                eq(userCreature.isLocked, false),
              ),
            )
            .returning({ id: userCreature.id })

          if (locked.length === 0) {
            // Creature no longer available — cancel trade + unlock receiver's creature
            await db.batch([
              db
                .update(tradeOffer)
                .set({ status: 'cancelled' })
                .where(eq(tradeOffer.id, body.tradeId)),
              db
                .update(userCreature)
                .set({ isLocked: false })
                .where(eq(userCreature.id, trade.receiverCreatureId)),
            ])
            return jsonResponse(
              {
                error: 'Your creature is no longer available — trade cancelled',
              },
              409,
            )
          }

          // Verify receiver's creature is still locked and owned
          const receiverOwns = await db
            .select({ id: userCreature.id })
            .from(userCreature)
            .where(
              and(
                eq(userCreature.id, trade.receiverCreatureId),
                eq(userCreature.userId, trade.receiverId),
                eq(userCreature.isLocked, true),
              ),
            )
            .get()

          if (!receiverOwns) {
            // Integrity violation — cancel trade, unlock offerer's creature
            await db.batch([
              db
                .update(tradeOffer)
                .set({ status: 'cancelled' })
                .where(eq(tradeOffer.id, body.tradeId)),
              db
                .update(userCreature)
                .set({ isLocked: false })
                .where(eq(userCreature.id, trade.offeredCreatureId)),
            ])
            return jsonResponse(
              { error: 'Trade integrity error — trade cancelled' },
              409,
            )
          }

          // Execute the entire confirm + swap atomically in one batch
          await db.batch([
            db
              .update(tradeOffer)
              .set({ status: 'accepted' })
              .where(
                and(
                  eq(tradeOffer.id, body.tradeId),
                  eq(tradeOffer.status, 'pending'),
                ),
              ),
            db
              .update(userCreature)
              .set({ userId: trade.receiverId, isLocked: false })
              .where(eq(userCreature.id, trade.offeredCreatureId)),
            db
              .update(userCreature)
              .set({ userId: trade.offererId, isLocked: false })
              .where(eq(userCreature.id, trade.receiverCreatureId)),
            db.insert(tradeHistory).values({
              id: nanoid(),
              tradeOfferId: body.tradeId,
              giverId: trade.offererId,
              receiverId: trade.receiverId,
              givenCreatureId: trade.offeredCreatureId,
              receivedCreatureId: trade.receiverCreatureId,
            }),
          ])

          // Cascade cancel: find all other open/pending trades offering the same creature
          const staleTrades = await db
            .select({
              id: tradeOffer.id,
              status: tradeOffer.status,
              receiverCreatureId: tradeOffer.receiverCreatureId,
            })
            .from(tradeOffer)
            .where(
              and(
                eq(tradeOffer.offeredCreatureId, trade.offeredCreatureId),
                ne(tradeOffer.id, body.tradeId),
                or(
                  eq(tradeOffer.status, 'open'),
                  eq(tradeOffer.status, 'pending'),
                ),
              ),
            )
            .all()

          if (staleTrades.length > 0) {
            const staleIds = staleTrades.map((t) => t.id)
            // Unlock receiver creatures from cancelled pending trades
            const receiverCreatureIds = staleTrades
              .filter((t) => t.status === 'pending' && t.receiverCreatureId)
              .map((t) => t.receiverCreatureId as string)

            await db.batch([
              db
                .update(tradeOffer)
                .set({ status: 'cancelled' })
                .where(inArray(tradeOffer.id, staleIds)),
              ...(receiverCreatureIds.length > 0
                ? [
                    db
                      .update(userCreature)
                      .set({ isLocked: false })
                      .where(inArray(userCreature.id, receiverCreatureIds)),
                  ]
                : []),
            ])
          }

          return jsonResponse({ success: true })
        }

        // Offerer rejects a pending proposal — trade returns to open
        if (body.action === 'reject') {
          return (
            (await resetPendingTrade(body.tradeId, 'offererId')) ??
            jsonResponse({ success: true })
          )
        }

        // Receiver withdraws their pending proposal — trade returns to open
        return (
          (await resetPendingTrade(body.tradeId, 'receiverId')) ??
          jsonResponse({ success: true })
        )
      },
    },
  },
})
