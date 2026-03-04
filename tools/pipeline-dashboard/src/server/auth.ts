import { randomUUID } from 'node:crypto'
import { Hono } from 'hono'
import { setCookie, getCookie, deleteCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'
import { SignJWT, jwtVerify } from 'jose'
import { eq, and } from 'drizzle-orm'
import type { EditorDatabase } from './db'
import { schema } from './db'
import type { EditorEnv } from './env'

export interface EditorUser {
  id: string
  name: string
  image: string | null
  role: string
}

const COOKIE_NAME = 'editor_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

const ALLOWED_ROLES = new Set(['admin', 'editor'])

let envRef: EditorEnv
let dbRef: EditorDatabase

export function initAuth(env: EditorEnv, db: EditorDatabase) {
  envRef = env
  dbRef = db
}

function getSecret() {
  return new TextEncoder().encode(envRef.AUTH_SECRET)
}

async function signToken(user: EditorUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    name: user.name,
    image: user.image,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

async function verifyToken(token: string): Promise<EditorUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return {
      id: payload.sub!,
      name: payload.name as string,
      image: (payload.image as string) ?? null,
      role: payload.role as string,
    }
  } catch {
    return null
  }
}

// ─── Discord OAuth helpers ──────────────────────────────────────────

const DISCORD_API = 'https://discord.com/api/v10'

async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<{ access_token: string }> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: envRef.DISCORD_CLIENT_ID,
      client_secret: envRef.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Discord token exchange failed: ${text}`)
  }
  return (await res.json()) as { access_token: string }
}

async function fetchDiscordUser(
  accessToken: string,
): Promise<{ id: string; username: string; avatar: string | null }> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Discord user')
  return (await res.json()) as { id: string; username: string; avatar: string | null }
}

// ─── Auth routes ────────────────────────────────────────────────────

export function createAuthRoutes() {
  const auth = new Hono()

  auth.get('/discord/login', (c) => {
    const redirectUri = `${envRef.EDITOR_URL}/auth/discord/callback`
    const state = randomUUID()
    setCookie(c, 'oauth_state', state, {
      httpOnly: true,
      secure: envRef.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 300,
      path: '/auth',
    })
    const params = new URLSearchParams({
      client_id: envRef.DISCORD_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'identify',
      state,
    })
    return c.redirect(`https://discord.com/oauth2/authorize?${params}`)
  })

  auth.get('/discord/callback', async (c) => {
    const code = c.req.query('code')
    if (!code) return c.text('Missing code', 400)

    // Verify CSRF state
    const expectedState = getCookie(c, 'oauth_state')
    const receivedState = c.req.query('state')
    if (!expectedState || receivedState !== expectedState) {
      return c.text('Invalid state', 400)
    }
    deleteCookie(c, 'oauth_state', { path: '/auth' })

    const redirectUri = `${envRef.EDITOR_URL}/auth/discord/callback`

    // Exchange code for access token
    const { access_token } = await exchangeCode(code, redirectUri)

    // Get Discord user info
    const discordUser = await fetchDiscordUser(access_token)

    // Look up this Discord account in the existing D1 user table
    const accounts = await dbRef
      .select({
        userId: schema.account.userId,
        userName: schema.user.name,
        userImage: schema.user.image,
        userRole: schema.user.role,
      })
      .from(schema.account)
      .innerJoin(schema.user, eq(schema.account.userId, schema.user.id))
      .where(
        and(
          eq(schema.account.providerId, 'discord'),
          eq(schema.account.accountId, discordUser.id),
        ),
      )

    if (accounts.length === 0) {
      return c.html(
        `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#1a1a1a;color:#fff;flex-direction:column">
          <h1>Account Not Found</h1>
          <p>You need to sign up at <a href="https://paleo-waifu.jacobmaynard.dev" style="color:#f59e0b">paleo-waifu.jacobmaynard.dev</a> first.</p>
          <a href="/auth/discord/login" style="color:#f59e0b;margin-top:1rem">Try again</a>
        </body></html>`,
      )
    }

    const account = accounts[0]

    // Check role
    if (!ALLOWED_ROLES.has(account.userRole ?? 'user')) {
      return c.html(
        `<html><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#1a1a1a;color:#fff;flex-direction:column">
          <h1>Access Denied</h1>
          <p>You don't have permission to use the editor. Ask an admin to grant you the <strong>editor</strong> role.</p>
          <a href="/auth/discord/login" style="color:#f59e0b;margin-top:1rem">Try again</a>
        </body></html>`,
      )
    }

    const user: EditorUser = {
      id: account.userId,
      name: account.userName,
      image: account.userImage,
      role: account.userRole ?? 'user',
    }

    const token = await signToken(user)

    setCookie(c, COOKIE_NAME, token, {
      httpOnly: true,
      secure: envRef.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    })

    return c.redirect('/')
  })

  auth.post('/logout', (c) => {
    deleteCookie(c, COOKIE_NAME, { path: '/' })
    return c.json({ ok: true })
  })

  return auth
}

// ─── Auth middleware ─────────────────────────────────────────────────

export const requireAuth = createMiddleware<{
  Variables: { user: EditorUser }
}>(async (c, next) => {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const user = await verifyToken(token)
  if (!user) {
    deleteCookie(c, COOKIE_NAME, { path: '/' })
    return c.json({ error: 'Invalid session' }, 401)
  }

  if (!ALLOWED_ROLES.has(user.role)) {
    return c.json({ error: 'Forbidden' }, 403)
  }

  c.set('user', user)
  await next()
})
