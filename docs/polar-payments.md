# Polar Payments Integration

## Context

PaleoWaifu is a prehistoric creature gacha game where players spend Fossils (the in-game currency) to pull creatures. Currently, Fossils can only be earned through a new-user bonus (10), daily claims (3/day), and the planned Discord XP system. Adding Polar as a payment provider lets players purchase Fossil packs with real money — a standard monetization path for gacha games.

Polar is a developer-focused Merchant of Record platform (4% + $0.40 per transaction, no monthly fees). It handles payment processing, tax compliance (VAT/GST/sales tax), and webhook-based order notifications. Better-auth has an official Polar plugin (`@polar-sh/better-auth`) that provides checkout creation, webhook signature verification, and customer portal — all wired into the existing auth system.

## Architecture

```
User clicks "Buy Fossils" on /shop
    │
    ▼
POST /api/shop (session-authenticated)
    │ Creates Polar checkout session via SDK
    ▼
Redirect to Polar checkout page
    │ User completes payment
    ▼
Polar sends webhook to POST /api/webhooks/polar
    │ Signature verified via POLAR_WEBHOOK_SECRET
    ▼
onOrderPaid handler:
    │ Look up user by Polar customer externalId (= better-auth user.id)
    │ Map productId → fossil amount
    │ UPDATE currency SET fossils = fossils + amount (idempotent via orderId)
    ▼
Redirect to /shop?success=true (user sees updated balance)
```

### Why this approach works well

- **No custom payment UI** — Polar hosts the checkout page with tax handling, card processing, and receipt emails
- **No PCI scope** — card details never touch our Worker; Polar is the Merchant of Record
- **better-auth plugin** handles customer creation, checkout sessions, and webhook verification — no manual crypto or signature parsing
- **`createCustomerOnSignUp: true`** automatically creates a Polar customer when users first sign in via Discord, linking `user.id` as the `externalId`
- **Fossil crediting is a single atomic SQL update** — same pattern as `refundFossils()` in `src/lib/gacha.ts:72`
- **Idempotent** — the `payment` table uses `polarOrderId` as a unique constraint, so webhook retries are safe

## Dependencies

```bash
pnpm add @polar-sh/sdk @polar-sh/better-auth
```

No new infrastructure. Everything runs on the existing Cloudflare Worker + D1 database.

## Product Tiers

| Tier | Fossils | Bonus | Total | Price (USD) | Fossils/$ |
|------|---------|-------|-------|-------------|-----------|
| Starter | 50 | — | 50 | $4.99 | 10.0 |
| Excavation | 150 | +50 | 200 | $14.99 | 13.3 |
| Expedition | 400 | +100 | 500 | $34.99 | 14.3 |

Bonus fossils reward larger purchases. Each tier maps to a Polar product created in the dashboard. Product IDs are stored in a `FOSSIL_PRODUCTS` constant (not in the database — these rarely change and are referenced by both server and client code).

## Database Changes

New table in `src/lib/db/schema.ts`:

```ts
export const payment = sqliteTable(
  'payment',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    polarOrderId: text('polar_order_id').notNull(),
    productId: text('product_id').notNull(),
    fossilsAwarded: integer('fossils_awarded').notNull(),
    amountCents: integer('amount_cents').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).default(
      sql`(unixepoch())`,
    ),
  },
  (table) => [
    uniqueIndex('payment_polar_order_idx').on(table.polarOrderId),
    index('payment_user_id_idx').on(table.userId),
  ],
)
```

The `polarOrderId` unique index is the idempotency key — if the same webhook fires twice, the second `INSERT` hits `ON CONFLICT DO NOTHING` and no duplicate fossils are awarded.

## Environment Variables

Add to `src/env.d.ts`:

```ts
interface Env {
  // ... existing vars
  POLAR_ACCESS_TOKEN: string
  POLAR_WEBHOOK_SECRET: string
}
```

Set in production:

```bash
wrangler secret put POLAR_ACCESS_TOKEN --env production
wrangler secret put POLAR_WEBHOOK_SECRET --env production
```

Add to `.env.example`:

```
POLAR_ACCESS_TOKEN=your_polar_access_token
POLAR_WEBHOOK_SECRET=your_polar_webhook_secret
```

For local development, use Polar's sandbox environment. Sandbox and production use separate access tokens and product IDs.

## Auth Changes

### Server (`src/lib/auth.ts`)

Add the Polar plugin to the existing `betterAuth` config:

```ts
import { polar, checkout, webhooks } from '@polar-sh/better-auth'
import { Polar } from '@polar-sh/sdk'

export async function createAuth(env: Env) {
  const db = await createDb(env.DB)

  const polarClient = new Polar({
    accessToken: env.POLAR_ACCESS_TOKEN,
  })

  return betterAuth({
    // ... existing config (database, socialProviders, session, etc.)

    plugins: [
      admin({ defaultRole: 'user' }),

      polar({
        client: polarClient,
        createCustomerOnSignUp: true,
        use: [
          checkout({
            successUrl: '/shop?success=true',
          }),
          webhooks({
            secret: env.POLAR_WEBHOOK_SECRET,
            onOrderPaid: async (payload) => {
              // Fossil crediting logic — see Webhook Handler section
            },
          }),
        ],
      }),
    ],
  })
}
```

### Client (`src/lib/auth-client.ts`)

Add the Polar client plugin:

```ts
import { createAuthClient } from 'better-auth/react'
import { adminClient } from 'better-auth/client/plugins'
import { polarClient } from '@polar-sh/better-auth/client'

export const authClient = createAuthClient({
  plugins: [adminClient(), polarClient()],
})

export const { signIn, signOut, useSession } = authClient
```

This exposes `authClient.checkout()` on the client for creating checkout sessions.

## Webhook Handler

The `onOrderPaid` handler inside the `webhooks()` plugin config:

```ts
onOrderPaid: async (payload) => {
  const order = payload.data
  const customerId = order.customer?.externalId // This is the better-auth user.id
  if (!customerId) return

  const product = FOSSIL_PRODUCTS.find((p) => p.polarProductId === order.productId)
  if (!product) return

  const db = await createDb(env.DB)

  // Idempotent insert — unique constraint on polar_order_id prevents duplicates
  const inserted = await db
    .insert(payment)
    .values({
      id: nanoid(),
      userId: customerId,
      polarOrderId: order.id,
      productId: order.productId,
      fossilsAwarded: product.fossils,
      amountCents: order.amount,
    })
    .onConflictDoNothing()
    .returning({ id: payment.id })

  // Only credit fossils if this is a new order (not a webhook retry)
  if (inserted.length > 0) {
    await db
      .update(currency)
      .set({
        fossils: sql`${currency.fossils} + ${product.fossils}`,
        updatedAt: sql`(unixepoch())`,
      })
      .where(eq(currency.userId, customerId))
  }
}
```

The better-auth Polar plugin automatically handles:
- Webhook signature verification (via `POLAR_WEBHOOK_SECRET`)
- Routing to the correct handler based on event type
- The webhook endpoint is served at `/api/auth/polar/webhooks` (under the existing better-auth catch-all route)

## Product Config

New file `src/lib/products.ts`:

```ts
export interface FossilProduct {
  id: string            // Internal identifier
  name: string
  fossils: number       // Total fossils awarded (base + bonus)
  priceCents: number    // Display price
  polarProductId: string // Polar product ID (from dashboard)
  badge?: string        // Optional UI badge ("Best Value", etc.)
}

export const FOSSIL_PRODUCTS: FossilProduct[] = [
  {
    id: 'starter',
    name: 'Starter Pack',
    fossils: 50,
    priceCents: 499,
    polarProductId: '', // Fill after creating in Polar dashboard
  },
  {
    id: 'excavation',
    name: 'Excavation Pack',
    fossils: 200,
    priceCents: 1499,
    polarProductId: '',
    badge: 'Popular',
  },
  {
    id: 'expedition',
    name: 'Expedition Pack',
    fossils: 500,
    priceCents: 3499,
    polarProductId: '',
    badge: 'Best Value',
  },
]
```

## New Routes

### Shop Page (`src/routes/_app/shop.tsx`)

Auth-guarded page (inside `_app/` layout group) showing:

- Current fossil balance (reuse existing `getFossils` server function)
- Three product cards with name, fossil count, bonus indicator, price, and "Buy" button
- Success banner when redirected back from Polar (`?success=true`)
- Each "Buy" button calls `authClient.checkout({ products: [product.polarProductId] })`

### No New API Routes Needed

The better-auth Polar plugin handles both checkout creation and webhook receipt through the existing `/api/auth/$` catch-all route:

- **Checkout**: `authClient.checkout()` calls the plugin's built-in endpoint
- **Webhook**: Polar sends events to `/api/auth/polar/webhooks`, handled by the `webhooks()` plugin

## Refund Handling

Polar supports refunds from their dashboard. Add a second webhook handler:

```ts
// Inside the webhooks() plugin config, alongside onOrderPaid
onOrderRefunded: async (payload) => {
  const order = payload.data
  const db = await createDb(env.DB)

  const paymentRow = await db
    .select()
    .from(payment)
    .where(eq(payment.polarOrderId, order.id))
    .get()

  if (!paymentRow) return

  // Deduct fossils — allow negative balance (admin can resolve manually)
  await db
    .update(currency)
    .set({
      fossils: sql`${currency.fossils} - ${paymentRow.fossilsAwarded}`,
      updatedAt: sql`(unixepoch())`,
    })
    .where(eq(currency.userId, paymentRow.userId))

  // Mark payment as refunded (add a status column, or delete the row)
}
```

If the user has already spent the fossils, their balance goes negative. This is intentional — it prevents them from pulling until they earn or buy enough to get back above zero. The existing `deductFossils` guard (`WHERE fossils >= cost`) handles this naturally.

## Polar Dashboard Setup (Manual)

1. Create a Polar account at https://polar.sh
2. Create an organization for PaleoWaifu
3. Create three products (one-time, digital):
   - Starter Pack — $4.99
   - Excavation Pack — $14.99
   - Expedition Pack — $34.99
4. Copy each product's ID into `src/lib/products.ts`
5. Generate an access token under Organization Settings → Developers
6. Set the webhook endpoint URL to `https://paleo-waifu.jacobmaynard.dev/api/auth/polar/webhooks`
7. Enable webhook events: `order.paid`, `order.refunded`
8. Copy the webhook secret

## Implementation Phases

### Phase 1: Foundation

- Install `@polar-sh/sdk` and `@polar-sh/better-auth`
- Add `POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET` to `env.d.ts` and `.env.example`
- Create `payment` table in schema, generate and apply migration
- Create `src/lib/products.ts` with product tier definitions
- Add Polar plugin to `src/lib/auth.ts` (server) and `src/lib/auth-client.ts` (client)
- Implement `onOrderPaid` handler with idempotent fossil crediting
- Create products in Polar sandbox dashboard, fill in product IDs
- Test locally: verify checkout flow and webhook delivery via Polar CLI

### Phase 2: Shop UI

- Create `/shop` route with product cards and buy buttons
- Wire buy buttons to `authClient.checkout()`
- Add success/error states on redirect back from Polar
- Add "Buy Fossils" link in the navigation and on the gacha page (especially when balance is low)
- Style to match existing game UI (rarity colors, card patterns from gacha page)

### Phase 3: Hardening

- Implement `onOrderRefunded` handler
- Add admin visibility: show payment history on admin user detail page (`/admin/users/$userId`)
- Set sandbox product IDs for dev, production IDs for prod (can key off `env.AUTH_BASE_URL` or a `POLAR_ENV` variable)
- Verify idempotency: manually replay a webhook and confirm no duplicate fossils
- Test edge cases: user buys fossils before having a `currency` row (call `ensureUserCurrency` in the webhook handler as a guard)

## Verification

- Polar sandbox checkout completes and redirects to `/shop?success=true`
- Fossils appear in user's balance immediately after webhook fires
- Duplicate webhook delivery does not award double fossils
- Refund deducts the correct fossil amount
- Payment row exists in `payment` table with correct `polarOrderId`, `fossilsAwarded`, `amountCents`
- `authClient.checkout()` returns a working checkout URL (not a 500)
- User without a `currency` row can still complete a purchase (handler calls `ensureUserCurrency`)
- Negative fossil balance after refund prevents pulls (existing `WHERE fossils >= cost` guard)
- Admin user detail page shows payment history
- Product IDs differ between sandbox and production environments

## Critical Files to Reference

- `src/lib/auth.ts` — Better-auth config where Polar plugin is added
- `src/lib/auth-client.ts` — Client-side auth where `polarClient()` is added
- `src/lib/gacha.ts` — `refundFossils()` pattern (line 72) for atomic fossil addition
- `src/lib/db/schema.ts` — `currency` table (line 163) that receives fossil credits
- `src/lib/types.ts` — `PULL_COST_SINGLE`, `PULL_COST_MULTI` constants
- `src/routes/api/gacha.ts` — API pattern to follow (CSRF check, session auth, Zod validation, jsonResponse)
- `src/routes/_app/gacha.tsx` — UI pattern for the gacha page (fossil balance display, button states)
- `src/routes/api/auth/$.ts` — Existing better-auth catch-all that will also serve Polar endpoints
