import {
  InteractionResponseType,
  InteractionType,
  ephemeralResponse,
  getInteractionUser,
  jsonResponse,
  verifySignature,
} from './lib/discord'
import { resolveDiscordUser } from './lib/auth'
import { BANNED_MESSAGE, UNLINKED_MESSAGE } from './lib/constants'
import { handleBalance } from './commands/balance'
import { handlePity } from './commands/pity'
import { handleDaily } from './commands/daily'
import { handleHelp } from './commands/help'
import { handleLevel } from './commands/level'
import { handlePull } from './commands/pull'
import { awardXp } from './lib/xp'
import type { Interaction } from './lib/discord'
import type { Database } from '@/lib/db/client'
import type { AppUser } from './lib/auth'
import { createDb } from '@/lib/db/client'

interface Env {
  DB: D1Database
  DISCORD_APPLICATION_ID: string
  DISCORD_PUBLIC_KEY: string
  DISCORD_BOT_TOKEN: string
  XP_API_SECRET: string
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const url = new URL(request.url)

    // XP endpoint — shared secret auth, not Discord signature
    if (url.pathname === '/api/xp') {
      return handleXpRequest(request, env)
    }

    // All other routes: Discord interaction flow
    const isValid = await verifySignature(request, env.DISCORD_PUBLIC_KEY)
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 })
    }

    const interaction: Interaction = await request.json()

    // Handle PING (endpoint verification)
    if (interaction.type === InteractionType.PING) {
      return jsonResponse({ type: InteractionResponseType.PONG })
    }

    // Only handle application commands
    if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
      return new Response('Unknown interaction type', { status: 400 })
    }

    const commandName = interaction.data?.name
    if (!commandName) {
      return new Response('Missing command name', { status: 400 })
    }

    // Help doesn't require auth
    if (commandName === 'help') {
      return handleHelp()
    }

    // Resolve Discord user to app user
    const discordUser = getInteractionUser(interaction)
    const db = await createDb(env.DB)
    const appUser = await resolveDiscordUser(db, discordUser.id)

    if (!appUser) {
      return ephemeralResponse(UNLINKED_MESSAGE)
    }

    if (appUser.banned) {
      return ephemeralResponse(BANNED_MESSAGE)
    }

    // Route to command handler
    return routeCommand(commandName, interaction, db, appUser, env, ctx)
  },
}

async function handleXpRequest(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${env.XP_API_SECRET}`) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  let body: { discordUserId?: string }
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ error: 'Bad request' }, 400)
  }

  if (!body.discordUserId) {
    return jsonResponse({ error: 'Missing discordUserId' }, 400)
  }

  const db = await createDb(env.DB)
  const appUser = await resolveDiscordUser(db, body.discordUserId)

  if (!appUser) {
    return jsonResponse({ error: 'User not linked' }, 404)
  }

  const result = await awardXp(db, appUser.id)
  return jsonResponse(result)
}

function routeCommand(
  name: string,
  interaction: Interaction,
  db: Database,
  appUser: AppUser,
  env: Env,
  ctx: ExecutionContext,
): Response | Promise<Response> {
  switch (name) {
    // Immediate commands — fast enough to query + respond within 3s
    case 'balance':
      return handleBalance(db, appUser)
    case 'pity':
      return handlePity(db, appUser)
    case 'level':
      return handleLevel(interaction, db, appUser)

    // Deferred commands — return type 5 immediately, do work in waitUntil
    case 'daily':
      return handleDaily(interaction, db, appUser, env, ctx)
    case 'pull':
      return handlePull(interaction, db, appUser, env, ctx, 1)
    case 'pull10':
      return handlePull(interaction, db, appUser, env, ctx, 10)

    default:
      return ephemeralResponse(`Unknown command: ${name}`)
  }
}
