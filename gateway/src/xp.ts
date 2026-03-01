import { EmbedBuilder  } from 'discord.js'
import { logger } from './logger.js'
import type {Message} from 'discord.js';

// These mirror src/lib/xp-config.ts — kept local since the gateway
// is a standalone Node.js process without the @/ path alias
const COOLDOWN_MS = 60_000
const MIN_MESSAGE_LENGTH = 4

// Validated at startup in index.ts
const API_URL = process.env.XP_API_URL!
const API_SECRET = process.env.XP_API_SECRET!

interface XpApiResponse {
  xp: number
  level: number
  leveledUp: boolean
}

// In-memory cooldown map — intentionally not persisted across restarts
const cooldowns = new Map<string, number>()

export function isEligible(message: Message): boolean {
  if (message.author.bot) return false
  if (!message.guild) return false
  if (message.content.length < MIN_MESSAGE_LENGTH) return false

  const lastEarned = cooldowns.get(message.author.id)
  if (lastEarned !== undefined && Date.now() - lastEarned < COOLDOWN_MS) {
    return false
  }

  return true
}

export async function handleXp(message: Message): Promise<void> {
  // Set cooldown before the API call to prevent concurrent duplicates
  cooldowns.set(message.author.id, Date.now())

  let response: Response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_SECRET}`,
      },
      body: JSON.stringify({ discordUserId: message.author.id }),
      signal: AbortSignal.timeout(5000),
    })
  } catch (err) {
    logger.error('XP API fetch failed', {
      userId: message.author.id,
      error: String(err),
    })
    cooldowns.delete(message.author.id)
    return
  }

  if (!response.ok) {
    if (response.status === 404) {
      // User not linked — expected, not an error. Keep cooldown to avoid
      // hammering the API for unlinked users.
      return
    }
    logger.error('XP API returned error', {
      userId: message.author.id,
      status: response.status,
    })
    // Clear cooldown on transient errors so user doesn't lose XP
    cooldowns.delete(message.author.id)
    return
  }

  const data = (await response.json()) as XpApiResponse

  logger.info('XP awarded', {
    userId: message.author.id,
    xp: data.xp,
    level: data.level,
    leveledUp: data.leveledUp,
  })

  if (!data.leveledUp) return

  await sendLevelUpEmbed(message, data)
}

async function sendLevelUpEmbed(
  message: Message,
  data: XpApiResponse,
): Promise<void> {
  const embed = new EmbedBuilder()
    .setColor(0xe8c95a)
    .setTitle('Level Up!')
    .setDescription(`<@${message.author.id}> reached **Level ${data.level}**!`)
    .setFooter({ text: `Total XP: ${data.xp.toLocaleString()}` })
    .setTimestamp()

  try {
    if (!('send' in message.channel)) return
    await message.channel.send({ embeds: [embed] })
  } catch (err) {
    logger.error('Failed to send level-up embed', {
      channelId: message.channelId,
      error: String(err),
    })
  }
}
