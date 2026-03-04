import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins'
import { createDb } from '@paleo-waifu/shared/db/client'
import * as schema from '@paleo-waifu/shared/db/schema'

export async function createAuth(env: Env) {
  const db = await createDb(env.DB)

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),

    plugins: [
      admin({
        defaultRole: 'user',
      }),
    ],

    socialProviders: {
      discord: {
        clientId: env.DISCORD_CLIENT_ID,
        clientSecret: env.DISCORD_CLIENT_SECRET,
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 60 * 5, // 5 minutes
      },
    },

    baseURL: env.AUTH_BASE_URL || 'http://localhost:3000',
    secret: env.AUTH_SECRET,
  })
}
