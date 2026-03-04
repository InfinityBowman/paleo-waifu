import { EmbedBuilder } from 'discord.js'
import { XP_COOLDOWN_MS, XP_MIN_MESSAGE_LENGTH } from '@paleo-waifu/shared/xp'
import { logger } from './logger.js'
import type { Message } from 'discord.js'

// Validated at startup in index.ts
const API_URL = process.env.XP_API_URL!
const API_SECRET = process.env.XP_API_SECRET!

interface XpApiResponse {
  xp: number
  level: number
  leveledUp: boolean
  fossilsEarned: number
}

// In-memory cooldown map — intentionally not persisted across restarts
const cooldowns = new Map<string, number>()

export function isEligible(message: Message): boolean {
  if (message.author.bot) return false
  if (!message.guild) return false
  if (message.content.length < XP_MIN_MESSAGE_LENGTH) return false

  const lastEarned = cooldowns.get(message.author.id)
  if (lastEarned !== undefined && Date.now() - lastEarned < XP_COOLDOWN_MS) {
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
  const isMilestone = data.level % 5 === 0

  const lines = [`<@${message.author.id}> reached **Level ${data.level}**!`]
  if (data.fossilsEarned > 0) {
    lines.push(
      isMilestone
        ? `\u{1F31F} **Milestone bonus!** +${data.fossilsEarned} Fossils`
        : `\u{1FAA8} +${data.fossilsEarned} Fossil${data.fossilsEarned !== 1 ? 's' : ''}`,
    )
  }

  const embed = new EmbedBuilder()
    .setColor(isMilestone ? 0xffd700 : 0xe8c95a)
    .setTitle(isMilestone ? '\u{1F31F} Milestone Level Up!' : 'Level Up!')
    .setDescription(lines.join('\n'))
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
