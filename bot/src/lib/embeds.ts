import { xpForLevel, xpToNextLevel } from '@paleo-waifu/shared/xp'
import { RARITY_EMOJI, RARITY_HEX, RARITY_LABEL } from './constants'
import type { Rarity } from '@paleo-waifu/shared/types'
import type { PullResult } from '@/lib/gacha'
import type { Embed } from './discord'

/** Build a full creature embed for a single pull */
export function creatureEmbed(pull: PullResult): Embed {
  const rarity = pull.rarity
  const fields: Embed['fields'] = [
    {
      name: 'Rarity',
      value: `${RARITY_EMOJI[rarity]} ${RARITY_LABEL[rarity]}`,
      inline: true,
    },
    { name: 'Era', value: pull.era, inline: true },
  ]

  if (pull.isNew) {
    fields.push({
      name: '\u2728 NEW',
      value: 'First time pulling this creature!',
      inline: false,
    })
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
  pulls: Array<PullResult>,
  newBalance: number,
): Embed {
  // Find the best pull by rarity order
  const rarityOrder: Array<Rarity> = [
    'legendary',
    'epic',
    'rare',
    'uncommon',
    'common',
  ]
  const bestPull = pulls.reduce((best, pull) => {
    const bestIdx = rarityOrder.indexOf(best.rarity)
    const pullIdx = rarityOrder.indexOf(pull.rarity)
    return pullIdx < bestIdx ? pull : best
  })

  const lines = pulls.map((p) => {
    const rarity = p.rarity
    const newBadge = p.isNew ? ' **NEW!**' : ''
    return `${RARITY_EMOJI[rarity]} **${p.name}** (${RARITY_LABEL[rarity]})${newBadge}`
  })

  const embed: Embed = {
    title: '10-Pull Results',
    description: lines.join('\n'),
    color: RARITY_HEX[bestPull.rarity],
    footer: { text: `Balance: ${newBalance} Fossils` },
  }

  if (bestPull.imageUrl) {
    embed.thumbnail = { url: bestPull.imageUrl }
  }

  return embed
}

/** Build an embed for the /leaderboard-xp command */
export function leaderboardXpEmbed(
  rows: Array<{ name: string; xp: number; level: number }>,
): Embed {
  if (rows.length === 0) {
    return {
      title: '\uD83C\uDFC6 XP Leaderboard',
      description: 'No players yet.',
      color: 0xe8c95a,
    }
  }

  const MEDALS = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49']
  const lines = rows.map((r, i) => {
    const prefix = MEDALS[i] ?? `${i + 1}.`
    return `${prefix} **${r.name}** — Level ${r.level} (${r.xp.toLocaleString()} XP)`
  })

  return {
    title: '\uD83C\uDFC6 XP Leaderboard',
    description: lines.join('\n'),
    color: 0xe8c95a,
  }
}

/** Build an embed for the /leaderboard-collection command */
export function leaderboardCollectionEmbed(
  rows: Array<{ name: string; uniqueSpecies: number }>,
  totalSpecies: number,
): Embed {
  if (rows.length === 0) {
    return {
      title: '\uD83D\uDCDA Collection Leaderboard',
      description: 'No players yet.',
      color: 0x5a8be8,
    }
  }

  const MEDALS = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49']
  const lines = rows.map((r, i) => {
    const prefix = MEDALS[i] ?? `${i + 1}.`
    const pct =
      totalSpecies > 0 ? Math.round((r.uniqueSpecies / totalSpecies) * 100) : 0
    return `${prefix} **${r.name}** — ${r.uniqueSpecies}/${totalSpecies} species (${pct}%)`
  })

  return {
    title: '\uD83D\uDCDA Collection Leaderboard',
    description: lines.join('\n'),
    color: 0x5a8be8,
  }
}

/** Build an embed for the /level command */
export function levelEmbed(username: string, xp: number, level: number): Embed {
  const nextLevelXp = xpForLevel(level + 1)
  const currentLevelXp = xpForLevel(level)
  const progress = Math.min(
    1,
    Math.max(
      0,
      nextLevelXp > currentLevelXp
        ? (xp - currentLevelXp) / (nextLevelXp - currentLevelXp)
        : 1,
    ),
  )
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
