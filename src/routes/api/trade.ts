import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { eq, and } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createDb } from '@/lib/db/client'
import { createAuth } from '@/lib/auth'
import { tradeOffer, tradeHistory, userCreature } from '@/lib/db/schema'

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

        const body = await request.json() as {
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
            return new Response(JSON.stringify({ error: 'offeredCreatureId required' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
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

        // Cancel trade
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
                eq(tradeOffer.status, 'open'),
              ),
            )
            .get()

          if (!trade) {
            return new Response(JSON.stringify({ error: 'Trade not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Unlock the creature
          await db
            .update(userCreature)
            .set({ isLocked: false })
            .where(eq(userCreature.id, trade.offeredCreatureId))

          await db
            .update(tradeOffer)
            .set({ status: 'cancelled' })
            .where(eq(tradeOffer.id, body.tradeId))

          return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' },
          })
        }

        // Accept trade
        if (body.action === 'accept') {
          if (!body.tradeId || !body.myCreatureId) {
            return new Response(
              JSON.stringify({ error: 'tradeId and myCreatureId required' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            )
          }

          // Atomically claim the trade to prevent double-accept race condition
          const claimed = await db
            .update(tradeOffer)
            .set({ status: 'accepted', receiverId: userId })
            .where(
              and(
                eq(tradeOffer.id, body.tradeId),
                eq(tradeOffer.status, 'open'),
              ),
            )
            .returning()

          if (claimed.length === 0) {
            return new Response(JSON.stringify({ error: 'Trade not found or already accepted' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const trade = claimed[0]

          if (trade.offererId === userId) {
            // Revert — can't accept own trade
            await db
              .update(tradeOffer)
              .set({ status: 'open', receiverId: null })
              .where(eq(tradeOffer.id, body.tradeId))
            return new Response(JSON.stringify({ error: 'Cannot accept own trade' }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Atomically lock acceptor's creature to prevent offering an already-traded creature
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
            // Revert trade status
            await db
              .update(tradeOffer)
              .set({ status: 'open', receiverId: null })
              .where(eq(tradeOffer.id, body.tradeId))
            return new Response(
              JSON.stringify({ error: 'Your creature not found or locked' }),
              { status: 400, headers: { 'Content-Type': 'application/json' } },
            )
          }

          // Batch the ownership swap + history insert atomically
          await db.batch([
            db
              .update(userCreature)
              .set({ userId, isLocked: false })
              .where(eq(userCreature.id, trade.offeredCreatureId)),
            db
              .update(userCreature)
              .set({ userId: trade.offererId, isLocked: false })
              .where(eq(userCreature.id, body.myCreatureId)),
            db.insert(tradeHistory).values({
              id: nanoid(),
              tradeOfferId: body.tradeId,
              giverId: trade.offererId,
              receiverId: userId,
              givenCreatureId: trade.offeredCreatureId,
              receivedCreatureId: body.myCreatureId,
            }),
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
