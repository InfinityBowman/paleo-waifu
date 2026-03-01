/**
 * Standalone script to register slash commands with the Discord API.
 *
 * Usage:
 *   npx tsx register.ts                  # Register to dev guild (instant)
 *   npx tsx register.ts --prod           # Register globally (takes up to 1 hour to propagate)
 *
 * Required env vars (in bot/.env):
 *   DISCORD_APPLICATION_ID
 *   DISCORD_BOT_TOKEN
 *   DISCORD_DEV_GUILD_ID    (optional, for guild-scoped registration during dev)
 */

const commands = [
  {
    name: 'pull',
    description: 'Pull a creature from the active banner (1 Fossil)',
  },
  {
    name: 'pull10',
    description: 'Pull 10 creatures from the active banner (10 Fossils)',
  },
  {
    name: 'daily',
    description: 'Claim your daily 3 free Fossils',
  },
  {
    name: 'balance',
    description: 'Check your Fossil balance',
  },
  {
    name: 'pity',
    description: 'Check your pity counters for the active banner',
  },
  {
    name: 'level',
    description: 'Check your XP and level',
    options: [
      {
        name: 'user',
        description: 'Check another user\'s level',
        type: 6, // USER
        required: false,
      },
    ],
  },
  {
    name: 'help',
    description: 'Show available commands',
  },
]

async function register() {
  const isProd = process.argv.includes('--prod')
  const appId = process.env.DISCORD_APPLICATION_ID
  const token = process.env.DISCORD_BOT_TOKEN
  const guildId = process.env.DISCORD_DEV_GUILD_ID

  if (!appId || !token) {
    console.error(
      'Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN in environment.',
    )
    console.error('Create a bot/.env file or export them.')
    process.exit(1)
  }

  let url: string
  if (isProd) {
    url = `https://discord.com/api/v10/applications/${appId}/commands`
    console.log('Registering commands globally (may take up to 1 hour)...')
  } else {
    if (!guildId) {
      console.error(
        'Missing DISCORD_DEV_GUILD_ID for dev registration.',
      )
      console.error(
        'Set it in bot/.env or use --prod for global registration.',
      )
      process.exit(1)
    }
    url = `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
    console.log(`Registering commands to guild ${guildId} (instant)...`)
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${token}`,
    },
    body: JSON.stringify(commands),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`Discord API error ${response.status}: ${text}`)
    process.exit(1)
  }

  const result = await response.json()
  console.log(
    `Successfully registered ${(result as Array<unknown>).length} commands:`,
  )
  for (const cmd of result as Array<{ name: string; id: string }>) {
    console.log(`  /${cmd.name} (${cmd.id})`)
  }
}

register()
