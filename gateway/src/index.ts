import { Client, Events, GatewayIntentBits } from 'discord.js'
import { handleXp, isEligible } from './xp.js'
import { logger } from './logger.js'

// Validate required env vars at startup
const REQUIRED_ENV = [
  'DISCORD_BOT_TOKEN',
  'XP_API_URL',
  'XP_API_SECRET',
] as const

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error(`Missing required environment variable: ${key}`)
    process.exit(1)
  }
}

logger.info('Gateway starting', {
  version: process.env.npm_package_version ?? 'unknown',
  nodeVersion: process.version,
  env: process.env.NODE_ENV ?? 'development',
})

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
})

client.once(Events.ClientReady, (readyClient) => {
  logger.info('Gateway listener connected', {
    username: readyClient.user.tag,
    guilds: readyClient.guilds.cache.size,
  })
})

client.on(Events.MessageCreate, async (message) => {
  if (!isEligible(message)) return
  await handleXp(message)
})

client.on(Events.ShardDisconnect, (event, shardId) => {
  logger.warn('Shard disconnected', { shardId, code: event.code })
})

client.on(Events.ShardReconnecting, (shardId) => {
  logger.info('Shard reconnecting', { shardId })
})

client.on(Events.ShardResume, (shardId, replayedEvents) => {
  logger.info('Shard resumed', { shardId, replayedEvents })
})

client.on(Events.ShardReady, (shardId) => {
  logger.info('Shard ready', { shardId })
})

client.on(Events.Warn, (info) => {
  logger.warn('Discord client warning', { info })
})

client.on(Events.Error, (error) => {
  logger.error('Discord client error', { error: error.message })
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down')
  client.destroy()
  process.exit(0)
})

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down')
  client.destroy()
  process.exit(0)
})

client.login(process.env.DISCORD_BOT_TOKEN).catch((err) => {
  logger.error('Failed to login to Discord', { error: String(err) })
  process.exit(1)
})
