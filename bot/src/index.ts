import {
  InteractionType,
  InteractionResponseType,
  getInteractionUser,
  jsonResponse,
  verifySignature,
  ephemeralResponse,
} from './lib/discord'
import { createDb } from '@/lib/db/client'
import { resolveDiscordUser } from './lib/auth'
import { BANNED_MESSAGE, UNLINKED_MESSAGE } from './lib/constants'
import { handleBalance } from './commands/balance'
import { handlePity } from './commands/pity'
import { handleDaily } from './commands/daily'
import { handleHelp } from './commands/help'
import { handlePull } from './commands/pull'
import type { Interaction } from './lib/discord'
import type { Database } from '@/lib/db/client'
import type { AppUser } from './lib/auth'

interface Env {
  DB: D1Database
  DISCORD_APPLICATION_ID: string
  DISCORD_PUBLIC_KEY: string
  DISCORD_BOT_TOKEN: string
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

    // Verify Discord signature
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
