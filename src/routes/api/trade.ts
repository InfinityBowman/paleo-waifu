import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { and, eq, ne } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createDb } from '@/lib/db/client'
import { createAuth } from '@/lib/auth'
import {
  creature,
  tradeHistory,
  tradeOffer,
  userCreature,
} from '@/lib/db/schema'

export const Route = createFileRoute('/api/trade')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfEnv = env as unknown as Env
        const auth = createAuth(cfEnv)
        const session = await auth.api.getSession({ headers: request.headers })
        if (!session) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const body = (await request.json()) as {
          action: string
          offeredCreatureId?: string
          wantedCreatureId?: string
          tradeId?: string
          myCreatureId?: string
        }
        const db = createDb(cfEnv.DB)
        const userId = session.user.id

        // Create trade offer
        if (body.action === 'create') {
          if (!body.offeredCreatureId) {
            return new Response(
              JSON.stringify({ error: 'offeredCreatureId required' }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              },
            )
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
            return new Response(
              JSON.stringify({ error: 'Creature not found or locked' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            )
          }

          const id = nanoid()
          await db.insert(tradeOffer).values({
            id,
            offererId: userId,
            offeredCreatureId: body.offeredCreatureId,
            wantedCreatureId: body.wantedCreatureId ?? null,
          })

          return new Response(JSON.stringify({ id }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Cancel trade (offerer only, from open or pending)
        if (body.action === 'cancel') {
          if (!body.tradeId) {
            return new Response(JSON.stringify({ error: 'tradeId required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
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
            return new Response(
              JSON.stringify({ error: 'Trade not found or not cancellable' }),
              {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              },
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

          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Propose to accept (sets trade to pending — offerer must confirm)
        if (body.action === 'accept') {
          if (!body.tradeId || !body.myCreatureId) {
            return new Response(
              JSON.stringify({ error: 'tradeId and myCreatureId required' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
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
            return new Response(
              JSON.stringify({ error: 'Your creature not found or locked' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
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
              return new Response(
                JSON.stringify({
                  error: 'This trade requires a specific creature species',
                }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
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
            return new Response(
              JSON.stringify({
                error:
                  'Trade not found, not open, or you cannot accept your own trade',
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
            )
          }

          return new Response(
            JSON.stringify({ success: true, status: 'pending' }),
            {
              headers: { 'Content-Type': 'application/json' },
            },
          )
        }

        // Offerer confirms a pending trade — executes the swap
        if (body.action === 'confirm') {
          if (!body.tradeId) {
            return new Response(JSON.stringify({ error: 'tradeId required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
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
            return new Response(
              JSON.stringify({ error: 'Trade not found or not pending' }),
              {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              },
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
            return new Response(
              JSON.stringify({ error: 'Trade integrity error — trade cancelled' }),
              { status: 409, headers: { 'Content-Type': 'application/json' } },
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

          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Offerer rejects a pending proposal — trade returns to open
        if (body.action === 'reject') {
          if (!body.tradeId) {
            return new Response(JSON.stringify({ error: 'tradeId required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

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

          if (!trade) {
            return new Response(
              JSON.stringify({ error: 'Trade not found or not pending' }),
              {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          // Atomically unlock receiver's creature and reset trade to open
          await db.batch([
            ...(trade.receiverCreatureId
              ? [
                  db
                    .update(userCreature)
                    .set({ isLocked: false })
                    .where(eq(userCreature.id, trade.receiverCreatureId)),
                ]
              : []),
            db
              .update(tradeOffer)
              .set({
                status: 'open',
                receiverId: null,
                receiverCreatureId: null,
              })
              .where(eq(tradeOffer.id, body.tradeId)),
          ])

          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Receiver withdraws their pending proposal — trade returns to open
        if (body.action === 'withdraw') {
          if (!body.tradeId) {
            return new Response(JSON.stringify({ error: 'tradeId required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const trade = await db
            .select()
            .from(tradeOffer)
            .where(
              and(
                eq(tradeOffer.id, body.tradeId),
                eq(tradeOffer.receiverId, userId),
                eq(tradeOffer.status, 'pending'),
              ),
            )
            .get()

          if (!trade) {
            return new Response(
              JSON.stringify({ error: 'Trade not found or not pending' }),
              {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
              },
            )
          }

          // Atomically unlock receiver's creature and reset trade to open
          await db.batch([
            ...(trade.receiverCreatureId
              ? [
                  db
                    .update(userCreature)
                    .set({ isLocked: false })
                    .where(eq(userCreature.id, trade.receiverCreatureId)),
                ]
              : []),
            db
              .update(tradeOffer)
              .set({
                status: 'open',
                receiverId: null,
                receiverCreatureId: null,
              })
              .where(eq(tradeOffer.id, body.tradeId)),
          ])

          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
