import { createDb } from '@paleo-waifu/shared/db/client'
import {
  InteractionResponseType,
  InteractionType,
  ephemeralResponse,
  getInteractionUser,
  jsonResponse,
  verifySignature,
} from './lib/discord'
import { resolveDiscordUser } from './lib/auth'
import { parseChallengeAction } from './lib/battle-helpers'
import { BANNED_MESSAGE, UNLINKED_MESSAGE } from './lib/constants'
import { handleBalance } from './commands/balance'
import { handleBattle } from './commands/battle'
import { handleBattles } from './commands/battles'
import { handleRating } from './commands/rating'
import { handlePity } from './commands/pity'
import { handleDaily } from './commands/daily'
import { handleHelp } from './commands/help'
import {
  handleLeaderboardCollection,
  handleLeaderboardXp,
} from './commands/leaderboard'
import { handleLevel } from './commands/level'
import { handlePull } from './commands/pull'
import { handleBattleAccept } from './components/battle-accept'
import { handleBattleDecline } from './components/battle-decline'
import { handleDefenderPreset } from './components/battle-defender-preset'
import { awardXp } from './lib/xp'
import type { Interaction } from './lib/discord'
import type { Database } from '@paleo-waifu/shared/db/client'
import type { AppUser } from './lib/auth'

interface Env {
  DB: D1Database
  DISCORD_APPLICATION_ID: string
  DISCORD_PUBLIC_KEY: string
  DISCORD_BOT_TOKEN: string
  XP_API_SECRET: string
  TEST_MODE?: string
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

    // Test-only DB endpoints — only available when TEST_MODE is set
    if (env.TEST_MODE && url.pathname.startsWith('/api/test/')) {
      return handleTestDb(request, url.pathname, env)
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

    // Handle MESSAGE_COMPONENT (buttons, select menus)
    if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
      return handleComponent(interaction, env, ctx)
    }

    // Handle APPLICATION_COMMAND
    if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
      return new Response('Unknown interaction type', { status: 400 })
    }

    const commandName = interaction.data?.name
    if (!commandName) {
      return new Response('Missing command name', { status: 400 })
    }

    // Commands that don't require auth
    if (commandName === 'help') {
      return handleHelp()
    }
    if (commandName === 'leaderboard-xp') {
      const db = await createDb(env.DB)
      return handleLeaderboardXp(db)
    }
    if (commandName === 'leaderboard-collection') {
      const db = await createDb(env.DB)
      return handleLeaderboardCollection(db)
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

async function handleComponent(
  interaction: Interaction,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const customId = interaction.data?.custom_id
  if (!customId) {
    return ephemeralResponse('Invalid component interaction.')
  }

  // Resolve the user
  const discordUser = getInteractionUser(interaction)
  const db = await createDb(env.DB)
  const appUser = await resolveDiscordUser(db, discordUser.id)

  if (!appUser) {
    return ephemeralResponse(UNLINKED_MESSAGE)
  }

  if (appUser.banned) {
    return ephemeralResponse(BANNED_MESSAGE)
  }

  // Parse custom_id: "battle_accept:challengeId", "battle_decline:challengeId", etc.
  const parsed = parseChallengeAction(customId)
  if (!parsed) {
    return ephemeralResponse('Unknown component interaction.')
  }

  const { action, challengeId } = parsed

  switch (action) {
    case 'battle_accept':
      return handleBattleAccept(interaction, db, appUser, challengeId, env, ctx)

    case 'battle_decline':
      return handleBattleDecline(interaction, db, appUser, challengeId, env)

    case 'battle_defender_preset': {
      // Select menu — get the selected value
      const presetId = interaction.data?.values?.[0]
      if (!presetId) {
        return ephemeralResponse('No preset selected.')
      }
      return handleDefenderPreset(
        interaction,
        db,
        appUser,
        challengeId,
        presetId,
        env,
        ctx,
      )
    }

    default:
      return ephemeralResponse('Unknown battle action.')
  }
}

async function handleTestDb(
  request: Request,
  pathname: string,
  env: Env,
): Promise<Response> {
  // Batch has a different body shape — handle it first
  if (pathname === '/api/test/batch') {
    const body: {
      statements: Array<{ sql: string; params?: Array<unknown> }>
    } = await request.json()
    const stmts = body.statements.map((s) => {
      const st = env.DB.prepare(s.sql)
      return s.params?.length ? st.bind(...s.params) : st
    })
    await env.DB.batch(stmts)
    return jsonResponse({ success: true })
  }

  const body: { sql: string; params?: Array<unknown> } = await request.json()
  if (!body.sql) {
    return jsonResponse({ error: 'Missing sql' }, 400)
  }

  const stmt = env.DB.prepare(body.sql)
  const bound = body.params?.length ? stmt.bind(...body.params) : stmt

  if (pathname === '/api/test/query') {
    const result = await bound.all()
    return jsonResponse({ rows: result.results })
  }

  if (pathname === '/api/test/execute') {
    await bound.run()
    return jsonResponse({ success: true })
  }

  return jsonResponse({ error: 'Unknown test endpoint' }, 404)
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
    case 'rating':
      return handleRating(interaction, db, appUser)

    // Immediate but with DB queries
    case 'battles':
      return handleBattles(db, appUser)

    // Deferred commands — return type 5 immediately, do work in waitUntil
    case 'daily':
      return handleDaily(interaction, db, appUser, env, ctx)
    case 'pull':
      return handlePull(interaction, db, appUser, env, ctx, 1)
    case 'pull10':
      return handlePull(interaction, db, appUser, env, ctx, 10)
    case 'battle':
      return handleBattle(interaction, db, appUser, env, ctx)

    default:
      return ephemeralResponse(`Unknown command: ${name}`)
  }
}
