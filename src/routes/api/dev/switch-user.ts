import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { eq } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createDb } from '@/lib/db/client'
import { user, session } from '@/lib/db/schema'
import { ensureUserCurrency } from '@/lib/gacha'

/** Sign a cookie value using HMAC-SHA256 (matches better-auth/better-call format) */
async function signCookieValue(
  value: string,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value),
  )
  const base64Sig = btoa(String.fromCharCode(...new Uint8Array(sig)))
  return encodeURIComponent(`${value}.${base64Sig}`)
}

export const Route = createFileRoute('/api/dev/switch-user')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!import.meta.env.DEV) {
          return new Response('Not Found', { status: 404 })
        }

        const body = (await request.json()) as { userId: string }
        const { userId } = body

        if (!userId?.startsWith('dev-user-')) {
          return new Response(
            JSON.stringify({ error: 'Invalid dev user ID' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          )
        }

        const cfEnv = env as unknown as Env
        const db = createDb(cfEnv.DB)

        // Verify user exists
        const userRow = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.id, userId))
          .get()

        if (!userRow) {
          return new Response(
            JSON.stringify({
              error: 'Dev user not found. Run pnpm db:seed:dev-users first.',
            }),
            { status: 404, headers: { 'Content-Type': 'application/json' } },
          )
        }

        // Ensure currency row exists
        await ensureUserCurrency(db, userId)

        // Create a new session
        const token = nanoid(32)
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

        await db.insert(session).values({
          id: nanoid(),
          token,
          userId,
          expiresAt,
          ipAddress: '127.0.0.1',
          userAgent: 'dev-account-switcher',
        })

        // Sign the session token cookie (better-auth uses HMAC-SHA256 signed cookies)
        const signedToken = await signCookieValue(token, cfEnv.AUTH_SECRET)
        const cookieOpts = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=604800'
        const headers = new Headers({ 'Content-Type': 'application/json' })
        headers.append(
          'Set-Cookie',
          `better-auth.session_token=${signedToken}; ${cookieOpts}`,
        )
        // Expire the session data cache cookie to prevent stale session
        headers.append(
          'Set-Cookie',
          'better-auth.session_data=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
        )

        return new Response(JSON.stringify({ success: true, userId }), {
          headers,
        })
      },
    },
  },
})
