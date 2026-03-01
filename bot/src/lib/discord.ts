// ─── Discord Interaction Types ──────────────────────────────────────

export enum InteractionType {
  PING = 1,
  APPLICATION_COMMAND = 2,
  MESSAGE_COMPONENT = 3,
  APPLICATION_COMMAND_AUTOCOMPLETE = 4,
}

export enum InteractionResponseType {
  PONG = 1,
  CHANNEL_MESSAGE_WITH_SOURCE = 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5,
}

export enum ApplicationCommandOptionType {
  SUB_COMMAND = 1,
  STRING = 3,
  INTEGER = 4,
  USER = 6,
}

export interface InteractionOption {
  name: string
  type: ApplicationCommandOptionType
  value: string | number
  focused?: boolean
}

export interface InteractionData {
  id: string
  name: string
  options?: InteractionOption[]
}

export interface InteractionUser {
  id: string
  username: string
  discriminator: string
  avatar: string | null
  global_name: string | null
}

export interface InteractionMember {
  user: InteractionUser
}

export interface Interaction {
  id: string
  token: string
  type: InteractionType
  data?: InteractionData
  member?: InteractionMember
  user?: InteractionUser
  application_id: string
}

export interface Embed {
  title?: string
  description?: string
  color?: number
  thumbnail?: { url: string }
  image?: { url: string }
  fields?: Array<{ name: string; value: string; inline?: boolean }>
  footer?: { text: string }
}

export interface InteractionResponse {
  type: InteractionResponseType
  data?: {
    content?: string
    embeds?: Embed[]
    flags?: number
  }
}

// ─── Flags ──────────────────────────────────────────────────────────

export const MessageFlags = {
  EPHEMERAL: 1 << 6,
} as const

// ─── Response Helpers ───────────────────────────────────────────────

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export function immediateResponse(
  content: string,
  options?: { ephemeral?: boolean; embeds?: Embed[] },
): Response {
  return jsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      embeds: options?.embeds,
      flags: options?.ephemeral ? MessageFlags.EPHEMERAL : undefined,
    },
  })
}

export function ephemeralResponse(
  content: string,
  embeds?: Embed[],
): Response {
  return immediateResponse(content, { ephemeral: true, embeds })
}

export function deferredResponse(ephemeral = false): Response {
  return jsonResponse({
    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      flags: ephemeral ? MessageFlags.EPHEMERAL : undefined,
    },
  })
}

/** Edit the deferred response via Discord REST API */
export async function editDeferredResponse(
  applicationId: string,
  interactionToken: string,
  body: { content?: string; embeds?: Embed[] },
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}/messages/@original`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error(
      `Failed to edit deferred response: ${res.status}`,
      await res.text(),
    )
  }
}

// ─── Signature Verification ─────────────────────────────────────────

/** Verify Discord Ed25519 signature using Web Crypto API */
export async function verifySignature(
  request: Request,
  publicKey: string,
): Promise<boolean> {
  const signature = request.headers.get('X-Signature-Ed25519')
  const timestamp = request.headers.get('X-Signature-Timestamp')

  if (!signature || !timestamp) return false

  const body = await request.clone().text()
  const message = new TextEncoder().encode(timestamp + body)

  const sigBytes = hexToUint8Array(signature)
  const keyBytes = hexToUint8Array(publicKey)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    'Ed25519',
    false,
    ['verify'],
  )

  return crypto.subtle.verify('Ed25519', cryptoKey, sigBytes, message)
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

// ─── Interaction Helpers ────────────────────────────────────────────

/** Get the Discord user from an interaction (works for guild and DM) */
export function getInteractionUser(interaction: Interaction): InteractionUser {
  return interaction.member?.user ?? interaction.user!
}

/** Get a named option value from the interaction */
export function getOption<T extends string | number>(
  interaction: Interaction,
  name: string,
): T | undefined {
  return interaction.data?.options?.find((o) => o.name === name)?.value as
    | T
    | undefined
}
