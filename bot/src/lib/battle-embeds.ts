import { getTierEmoji, getTierLabel } from './battle-helpers'
import { APP_URL } from './constants'
import type { ActionRow, Embed } from './discord'

/** Challenge embed shown publicly when /battle @user is used */
export function challengeEmbed(
  challengerName: string,
  defenderName: string,
  presetName: string,
  challengerId: string,
): Embed {
  return {
    title: '\u2694\uFE0F Battle Challenge!',
    description: `**${challengerName}** has challenged **${defenderName}** to a battle!\n\nTeam: **${presetName}**`,
    color: 0xe8c95a, // amber
    footer: { text: `Challenger: ${challengerId}` },
  }
}

/** Accept / Decline button row */
export function challengeButtons(challengeId: string): ActionRow {
  return {
    type: 1,
    components: [
      {
        type: 2,
        style: 3, // success (green)
        label: 'Accept',
        custom_id: `battle_accept:${challengeId}`,
      },
      {
        type: 2,
        style: 4, // danger (red)
        label: 'Decline',
        custom_id: `battle_decline:${challengeId}`,
      },
    ],
  }
}

/** Preset select menu for defender choosing a team */
export function presetSelectMenu(
  challengeId: string,
  presets: Array<{ id: string; name: string }>,
  isChallenger: boolean,
): ActionRow {
  const prefix = isChallenger
    ? 'battle_challenger_preset'
    : 'battle_defender_preset'
  return {
    type: 1,
    components: [
      {
        type: 3,
        custom_id: `${prefix}:${challengeId}`,
        placeholder: 'Choose your team preset...',
        options: presets.map((p) => ({
          label: p.name,
          value: p.id,
        })),
      },
    ],
  }
}

/** Battle result embed */
export function battleResultEmbed(opts: {
  challengerName: string
  defenderName: string
  winnerId: string | null
  challengerId: string
  defenderId: string
  turns: number
  reason: string
  challengerRating: number
  defenderRating: number
  challengerDelta: number
  defenderDelta: number
  battleId: string
}): Embed {
  const winnerName =
    opts.winnerId === opts.challengerId
      ? opts.challengerName
      : opts.winnerId === opts.defenderId
        ? opts.defenderName
        : null

  const resultText = winnerName
    ? `\uD83C\uDFC6 **${winnerName}** wins!`
    : '\uD83E\uDD1D **Draw!**'

  const formatDelta = (d: number) => (d >= 0 ? `+${d}` : `${d}`)

  return {
    title: '\u2694\uFE0F Battle Result',
    description: [
      `${opts.challengerName} vs ${opts.defenderName}`,
      '',
      resultText,
      `${opts.turns} turns \u2022 ${opts.reason === 'ko' ? 'By KO' : 'By timeout'}`,
      '',
      `**${opts.challengerName}**: ${opts.challengerRating} (${formatDelta(opts.challengerDelta)}) ${getTierEmoji(opts.challengerRating)} ${getTierLabel(opts.challengerRating)}`,
      `**${opts.defenderName}**: ${opts.defenderRating} (${formatDelta(opts.defenderDelta)}) ${getTierEmoji(opts.defenderRating)} ${getTierLabel(opts.defenderRating)}`,
      '',
      `[View Replay](${APP_URL}/battle/${opts.battleId})`,
    ].join('\n'),
    color: opts.winnerId ? 0xe8c95a : 0x9ea3b8,
  }
}

/** Declined challenge embed update */
export function declinedEmbed(
  challengerName: string,
  defenderName: string,
): Embed {
  return {
    title: '\u2694\uFE0F Challenge Declined',
    description: `**${defenderName}** declined the challenge from **${challengerName}**.`,
    color: 0x9ea3b8,
  }
}

/** No presets message */
export function noPresetsMessage(): string {
  return `You don't have any team presets! Create one at ${APP_URL}/battle first.`
}
