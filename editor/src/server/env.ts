export interface EditorEnv {
  CF_ACCOUNT_ID: string
  CF_D1_DATABASE_ID: string
  CF_API_TOKEN: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_BUCKET_NAME: string
  DISCORD_CLIENT_ID: string
  DISCORD_CLIENT_SECRET: string
  AUTH_SECRET: string
  EDITOR_URL: string
  PORT: number
  NODE_ENV: string
  IMAGES_DIR: string
}

const REQUIRED = [
  'CF_ACCOUNT_ID',
  'CF_D1_DATABASE_ID',
  'CF_API_TOKEN',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'AUTH_SECRET',
  'EDITOR_URL',
] as const

export function loadEnv(): EditorEnv {
  const missing = REQUIRED.filter((k) => !process.env[k])
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`)
  }

  return {
    CF_ACCOUNT_ID: process.env.CF_ACCOUNT_ID!,
    CF_D1_DATABASE_ID: process.env.CF_D1_DATABASE_ID!,
    CF_API_TOKEN: process.env.CF_API_TOKEN!,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID!,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY!,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || 'paleo-waifu-images-prod',
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID!,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET!,
    AUTH_SECRET: process.env.AUTH_SECRET!,
    EDITOR_URL: process.env.EDITOR_URL!,
    PORT: Number(process.env.PORT) || 4100,
    NODE_ENV: process.env.NODE_ENV || 'development',
    IMAGES_DIR:
      process.env.IMAGES_DIR ||
      new URL('../../../../python/data/images', import.meta.url).pathname,
  }
}
