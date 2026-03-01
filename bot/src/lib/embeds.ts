import { RARITY_EMOJI, RARITY_HEX, RARITY_LABEL } from './constants'
import { xpForLevel, xpToNextLevel } from '@/lib/xp-config'
import type { Rarity } from '@/lib/types'
import type { PullResult } from '@/lib/gacha'
import type { Embed } from './discord'

/** Build a full creature embed for a single pull */
export function creatureEmbed(pull: PullResult): Embed {
  const rarity = pull.rarity as Rarity
  const fields: Embed['fields'] = [
    { name: 'Rarity', value: `${RARITY_EMOJI[rarity]} ${RARITY_LABEL[rarity]}`, inline: true },
    { name: 'Era', value: pull.era, inline: true },
  ]

  if (pull.isNew) {
    fields.push({ name: '\u2728 NEW', value: 'First time pulling this creature!', inline: false })
  }

  const embed: Embed = {
    title: pull.name,
    description: `*${pull.scientificName}*\n\n${pull.description}`,
    color: RARITY_HEX[rarity],
    fields,
  }

  if (pull.imageUrl) {
    embed.image = { url: pull.imageUrl }
  }

  return embed
}

/** Build a compact list embed for a 10-pull */
export function multiPullEmbed(
  pulls: PullResult[],
  newBalance: number,
): Embed {
  // Find the best pull by rarity order
  const rarityOrder: Rarity[] = ['legendary', 'epic', 'rare', 'uncommon', 'common']
  const bestPull = pulls.reduce((best, pull) => {
    const bestIdx = rarityOrder.indexOf(best.rarity as Rarity)
    const pullIdx = rarityOrder.indexOf(pull.rarity as Rarity)
    return pullIdx < bestIdx ? pull : best
  })

  const lines = pulls.map((p) => {
    const rarity = p.rarity as Rarity
    const newBadge = p.isNew ? ' **NEW!**' : ''
    return `${RARITY_EMOJI[rarity]} **${p.name}** — ${RARITY_LABEL[rarity]}${newBadge}`
  })

  const embed: Embed = {
    title: '10-Pull Results',
    description: lines.join('\n'),
    color: RARITY_HEX[bestPull.rarity as Rarity],
    footer: { text: `Balance: ${newBalance} Fossils` },
  }

  if (bestPull.imageUrl) {
    embed.thumbnail = { url: bestPull.imageUrl }
  }

  return embed
}

/** Build an embed for the /level command */
export function levelEmbed(username: string, xp: number, level: number): Embed {
  const nextLevelXp = xpForLevel(level + 1)
  const currentLevelXp = xpForLevel(level)
  const progress = Math.min(1, Math.max(0,
    nextLevelXp > currentLevelXp
      ? (xp - currentLevelXp) / (nextLevelXp - currentLevelXp)
      : 1,
  ))
  const toNext = xpToNextLevel(xp)

  const barLength = 10
  const filled = Math.round(progress * barLength)
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barLength - filled)
  const pct = Math.round(progress * 100)

  return {
    title: `${username}'s Level`,
    description: [
      `**Level ${level}**`,
      `\`${bar}\` ${pct}%`,
      `**${xp.toLocaleString()}** XP total \u2022 **${toNext.toLocaleString()}** XP to next level`,
    ].join('\n'),
    color: 0xe8c95a,
  }
}
