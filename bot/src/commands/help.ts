import { ephemeralResponse } from '../lib/discord'
import { APP_URL } from '../lib/constants'

const HELP_TEXT = [
  '**PaleoWaifu Bot Commands**',
  '',
  '\uD83E\uDEA8 `/balance` - Check your Fossil balance',
  '\uD83C\uDF81 `/daily` - Claim your daily 3 free Fossils',
  '\u2728 `/pull` - Pull a creature (1 Fossil)',
  '\uD83C\uDF1F `/pull10` - Pull 10 creatures (10 Fossils)',
  '\uD83D\uDCCA `/pity` - Check your pity counters',
  '\uD83D\uDCC8 `/level` - Check your XP and level',
  '\uD83C\uDFC6 `/leaderboard-xp` - Top 10 players by XP level',
  '\uD83D\uDCDA `/leaderboard-collection` - Top 10 by species collected',
  '',
  '\u2694\uFE0F `/battle @user` - Challenge a player to battle',
  '\uD83D\uDCCB `/battles` - View active challenges & history',
  '\uD83C\uDFC5 `/rating` - Check your arena rating',
  '',
  `Play on the web: ${APP_URL}`,
].join('\n')

/** /help — Show available commands (immediate, ephemeral) */
export function handleHelp(): Response {
  return ephemeralResponse(HELP_TEXT)
}
