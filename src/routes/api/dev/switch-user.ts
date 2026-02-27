import { createFileRoute } from '@tanstack/react-router'

// In production builds, Vite replaces import.meta.env.DEV with false and
// tree-shakes the handler body. The runtime check below is a defense-in-depth
// guard in case the compile-time replacement is ever bypassed.

const notFound = () => new Response('Not Found', { status: 404 })

export const Route = createFileRoute('/api/dev/switch-user')({
  server: {
    handlers: {
      POST: import.meta.env.DEV
        ? async ({ request }) => {
            // Runtime double-check — only allow if positively confirmed as dev
            const isDev =
              typeof process !== 'undefined' &&
              process.env.NODE_ENV === 'development'
            if (!isDev) {
              return notFound()
            }

            const { eq } = await import('drizzle-orm')
            const { nanoid } = await import('nanoid')
            const { createDb } = await import('@/lib/db/client')
            const { getCfEnv } = await import('@/lib/env')
            const { session, user } = await import('@/lib/db/schema')
            const { ensureUserCurrency } = await import('@/lib/gacha')

            const body = (await request.json()) as { userId: string }
            const { userId } = body

            if (!userId?.startsWith('dev-user-')) {
              return new Response(
                JSON.stringify({ error: 'Invalid dev user ID' }),
                {
                  status: 400,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            }

            const cfEnv = getCfEnv()
            const db = await createDb(cfEnv.DB)

            const userRow = await db
              .select({ id: user.id })
              .from(user)
              .where(eq(user.id, userId))
              .get()

            if (!userRow) {
              return new Response(
                JSON.stringify({
                  error:
                    'Dev user not found. Run pnpm db:seed:dev-users first.',
                }),
                {
                  status: 404,
                  headers: { 'Content-Type': 'application/json' },
                },
              )
            }

            await ensureUserCurrency(db, userId)

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

            /** Sign a cookie value using HMAC-SHA256 (matches better-auth format) */
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
              const base64Sig = btoa(
                String.fromCharCode(...new Uint8Array(sig)),
              )
              return encodeURIComponent(`${value}.${base64Sig}`)
            }

            const signedToken = await signCookieValue(token, cfEnv.AUTH_SECRET)
            const cookieOpts = 'Path=/; HttpOnly; SameSite=Lax; Max-Age=604800'
            const headers = new Headers({ 'Content-Type': 'application/json' })
            headers.append(
              'Set-Cookie',
              `better-auth.session_token=${signedToken}; ${cookieOpts}`,
            )
            headers.append(
              'Set-Cookie',
              'better-auth.session_data=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
            )

            return new Response(JSON.stringify({ success: true, userId }), {
              headers,
            })
          }
        : notFound,
    },
  },
})
