import { createDb } from '@paleo-waifu/shared/db/client'
import {
  createWorkersLogger,
  initWorkersLog,
} from '@paleo-waifu/shared/logger'
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
import type { RequestLogger } from '@paleo-waifu/shared/logger'
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
  ENVIRONMENT?: string
}

let loggerInitialized = false
function ensureLogger(env: Env) {
  if (loggerInitialized) return
  initWorkersLog({
    service: 'bot',
    environment: env.ENVIRONMENT ?? 'development',
  })
  loggerInitialized = true
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    ensureLogger(env)
    const log = createWorkersLogger(request)

    try {
      const response = await route(request, env, ctx, log)
      log.emit({ status: response.status })
      return response
    } catch (err) {
      log.error(err as Error)
      log.emit({ status: 500, reason: 'unhandled_exception' })
      throw err
    }
  },
}

async function route(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  log: RequestLogger,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const url = new URL(request.url)

  if (url.pathname === '/api/xp') {
    log.set({ route: 'xp' })
    return handleXpRequest(request, env, log)
  }

  if (env.TEST_MODE && url.pathname.startsWith('/api/test/')) {
    log.set({ route: 'test_db', path: url.pathname })
    return handleTestDb(request, url.pathname, env)
  }

  log.set({ route: 'discord_interaction' })
  const isValid = await verifySignature(request, env.DISCORD_PUBLIC_KEY)
  if (!isValid) {
    log.set({ reason: 'bad_signature' })
    return new Response('Invalid signature', { status: 401 })
  }

  const interaction: Interaction = await request.json()
  log.set({ interactionType: interaction.type })

  if (interaction.type === InteractionType.PING) {
    return jsonResponse({ type: InteractionResponseType.PONG })
  }

  if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
    return handleComponent(interaction, env, ctx, log)
  }

  if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
    return new Response('Unknown interaction type', { status: 400 })
  }

  const commandName = interaction.data?.name
  if (!commandName) {
    return new Response('Missing command name', { status: 400 })
  }
  log.set({ command: commandName })

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

  const discordUser = getInteractionUser(interaction)
  log.set({ discord: { userId: discordUser.id } })
  const db = await createDb(env.DB)
  const appUser = await resolveDiscordUser(db, discordUser.id)

  if (!appUser) {
    log.set({ reason: 'unlinked' })
    return ephemeralResponse(UNLINKED_MESSAGE)
  }

  if (appUser.banned) {
    log.set({ reason: 'banned' })
    return ephemeralResponse(BANNED_MESSAGE)
  }

  log.set({ user: { id: appUser.id } })
  return routeCommand(commandName, interaction, db, appUser, env, ctx)
}

async function handleXpRequest(
  request: Request,
  env: Env,
  log: RequestLogger,
): Promise<Response> {
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${env.XP_API_SECRET}`) {
    log.set({ reason: 'bad_xp_secret' })
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
  log.set({ discord: { userId: body.discordUserId } })

  const db = await createDb(env.DB)
  const appUser = await resolveDiscordUser(db, body.discordUserId)

  if (!appUser) {
    log.set({ reason: 'unlinked' })
    return jsonResponse({ error: 'User not linked' }, 404)
  }
  log.set({ user: { id: appUser.id } })

  const result = await awardXp(db, appUser.id)
  log.set({
    xp: {
      total: result.xp,
      level: result.level,
      leveledUp: result.leveledUp,
      fossilsEarned: result.fossilsEarned,
    },
  })
  return jsonResponse(result)
}

async function handleComponent(
  interaction: Interaction,
  env: Env,
  ctx: ExecutionContext,
  log: RequestLogger,
): Promise<Response> {
  log.set({ component: { customId: interaction.data?.custom_id } })
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
