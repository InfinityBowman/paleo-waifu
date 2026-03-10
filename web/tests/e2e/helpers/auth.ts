import { nanoid } from 'nanoid'

import { execute } from './db-seed'

/**
 * Sign a cookie value using HMAC-SHA256, matching better-auth's format.
 * Reproduces the logic from web/src/routes/api/dev/switch-user.ts.
 */
async function signCookieValue(value: string, secret: string): Promise<string> {
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

function getAuthSecret(): string {
  const secret = process.env.__TEST_AUTH_SECRET
  if (!secret) throw new Error('__TEST_AUTH_SECRET not set')
  return secret
}

/**
 * Create an authenticated session for a test user.
 * Inserts a session row into D1 and returns the signed cookie string
 * ready to use in `Cookie` headers.
 */
export async function createSession(userId: string): Promise<string> {
  const sessionId = nanoid()
  const token = nanoid(32)
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 // 7 days
  const now = Math.floor(Date.now() / 1000)

  await execute(
    `INSERT INTO session (id, token, userId, expiresAt, createdAt, updatedAt, ipAddress, userAgent)
     VALUES (?, ?, ?, ?, ?, ?, '127.0.0.1', 'e2e-test')`,
    sessionId,
    token,
    userId,
    expiresAt,
    now,
    now,
  )

  const signedToken = await signCookieValue(token, getAuthSecret())
  return `better-auth.session_token=${signedToken}`
}
