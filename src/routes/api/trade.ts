import { createFileRoute } from '@tanstack/react-router'
import { and, eq, ne } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { getCfEnv } from '@/lib/env'
import { createDb } from '@/lib/db/client'
import { createAuth } from '@/lib/auth'
import { tradeHistory, tradeOffer, userCreature } from '@/lib/db/schema'
import { jsonResponse } from '@/lib/utils'

export const Route = createFileRoute('/api/trade')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfEnv = getCfEnv()
        const auth = await createAuth(cfEnv)
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return jsonResponse({ error: 'Unauthorized' }, 401)
        }

        const body = (await request.json()) as {
          action: string
          offeredCreatureId?: string
          wantedCreatureId?: string
          tradeId?: string
          myCreatureId?: string
        }
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
          if (!body.offeredCreatureId) {
            return jsonResponse({ error: 'offeredCreatureId required' }, 400)
          }

          // Atomically verify ownership + lock in one step to prevent race conditions
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
              { error: 'Creature not found or locked' },
              400,
            )
          }

          const id = nanoid()
          await db.insert(tradeOffer).values({
            id,
            offererId: userId,
            offeredCreatureId: body.offeredCreatureId,
            wantedCreatureId: body.wantedCreatureId ?? null,
          })

          return jsonResponse({ id })
        }

        // Cancel trade (offerer only, from open or pending)
        if (body.action === 'cancel') {
          if (!body.tradeId) {
            return jsonResponse({ error: 'tradeId required' }, 400)
          }

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

          // Atomically unlock creatures and cancel trade in one batch
          await db.batch([
            db
              .update(userCreature)
              .set({ isLocked: false })
              .where(eq(userCreature.id, trade.offeredCreatureId)),
            // If pending, also unlock the receiver's creature
            ...(trade.status === 'pending' && trade.receiverCreatureId
              ? [
                  db
                    .update(userCreature)
                    .set({ isLocked: false })
                    .where(eq(userCreature.id, trade.receiverCreatureId)),
                ]
              : []),
            db
              .update(tradeOffer)
              .set({ status: 'cancelled' })
              .where(eq(tradeOffer.id, body.tradeId)),
          ])

          return jsonResponse({ success: true })
        }

        // Propose to accept (sets trade to pending — offerer must confirm)
        if (body.action === 'accept') {
          if (!body.tradeId || !body.myCreatureId) {
            return jsonResponse(
              { error: 'tradeId and myCreatureId required' },
              400,
            )
          }

          // Lock the acceptor's creature FIRST — verify ownership before touching the trade
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
          const trade = await db
            .select({
              wantedCreatureId: tradeOffer.wantedCreatureId,
              status: tradeOffer.status,
            })
            .from(tradeOffer)
            .where(eq(tradeOffer.id, body.tradeId))
            .get()

          if (trade?.wantedCreatureId) {
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

          // Now atomically claim the trade as pending — prevents double-propose and self-trade
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
          if (!body.tradeId) {
            return jsonResponse({ error: 'tradeId required' }, 400)
          }

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

          // Re-verify creature ownership at confirm time to prevent tampering
          const [offererOwns, receiverOwns] = await Promise.all([
            db
              .select({ id: userCreature.id })
              .from(userCreature)
              .where(
                and(
                  eq(userCreature.id, trade.offeredCreatureId),
                  eq(userCreature.userId, trade.offererId),
                  eq(userCreature.isLocked, true),
                ),
              )
              .get(),
            db
              .select({ id: userCreature.id })
              .from(userCreature)
              .where(
                and(
                  eq(userCreature.id, trade.receiverCreatureId),
                  eq(userCreature.userId, trade.receiverId),
                  eq(userCreature.isLocked, true),
                ),
              )
              .get(),
          ])

          if (!offererOwns || !receiverOwns) {
            // Integrity violation — cancel the trade and unlock creatures
            await db
              .update(tradeOffer)
              .set({ status: 'cancelled' })
              .where(eq(tradeOffer.id, body.tradeId))
            await db
              .update(userCreature)
              .set({ isLocked: false })
              .where(eq(userCreature.id, trade.offeredCreatureId))
            if (trade.receiverCreatureId) {
              await db
                .update(userCreature)
                .set({ isLocked: false })
                .where(eq(userCreature.id, trade.receiverCreatureId))
            }
            return jsonResponse(
              { error: 'Trade integrity error — trade cancelled' },
              409,
            )
          }

          // Execute the entire confirm + swap atomically in one batch
          // This prevents partial failure from leaving creatures locked
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

          return jsonResponse({ success: true })
        }

        // Offerer rejects a pending proposal — trade returns to open
        if (body.action === 'reject') {
          if (!body.tradeId) {
            return jsonResponse({ error: 'tradeId required' }, 400)
          }
          return (
            (await resetPendingTrade(body.tradeId, 'offererId')) ??
            jsonResponse({ success: true })
          )
        }

        // Receiver withdraws their pending proposal — trade returns to open
        if (body.action === 'withdraw') {
          if (!body.tradeId) {
            return jsonResponse({ error: 'tradeId required' }, 400)
          }
          return (
            (await resetPendingTrade(body.tradeId, 'receiverId')) ??
            jsonResponse({ success: true })
          )
        }

        return jsonResponse({ error: 'Unknown action' }, 400)
      },
    },
  },
})
