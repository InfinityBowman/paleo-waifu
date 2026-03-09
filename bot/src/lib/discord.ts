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
  DEFERRED_UPDATE_MESSAGE = 6,
  UPDATE_MESSAGE = 7,
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
  options?: Array<InteractionOption>
  custom_id?: string
  component_type?: number
  values?: Array<string>
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
  message?: { id: string; channel_id: string }
  member?: InteractionMember
  user?: InteractionUser
  channel_id?: string
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

export interface ActionRow {
  type: 1
  components: Array<Button | SelectMenu>
}

export interface Button {
  type: 2
  style: 1 | 2 | 3 | 4 | 5 // primary, secondary, success, danger, link
  label: string
  custom_id?: string
  url?: string
  disabled?: boolean
}

export interface SelectMenu {
  type: 3
  custom_id: string
  placeholder?: string
  options: Array<{
    label: string
    value: string
    description?: string
    default?: boolean
  }>
  min_values?: number
  max_values?: number
}

export interface InteractionResponse {
  type: InteractionResponseType
  data?: {
    content?: string
    embeds?: Array<Embed>
    components?: Array<ActionRow>
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
  options?: { ephemeral?: boolean; embeds?: Array<Embed> },
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
  embeds?: Array<Embed>,
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

/** Defer a component interaction update (shows loading state on the message) */
export function deferredUpdateResponse(): Response {
  return jsonResponse({ type: InteractionResponseType.DEFERRED_UPDATE_MESSAGE })
}

/** Update the original message in-place (for component interactions) */
export function updateMessageResponse(body: {
  content?: string
  embeds?: Array<Embed>
  components?: Array<ActionRow>
}): Response {
  return jsonResponse({
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: body,
  })
}

/** Respond to an interaction with components */
export function immediateResponseWithComponents(
  content: string,
  components: Array<ActionRow>,
  options?: { ephemeral?: boolean; embeds?: Array<Embed> },
): Response {
  return jsonResponse({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content,
      embeds: options?.embeds,
      components,
      flags: options?.ephemeral ? MessageFlags.EPHEMERAL : undefined,
    },
  })
}

/** Send a follow-up message to an interaction */
export async function sendFollowup(
  applicationId: string,
  interactionToken: string,
  body: {
    content?: string
    embeds?: Array<Embed>
    components?: Array<ActionRow>
    flags?: number
  },
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error(`Failed to send followup: ${res.status}`, await res.text())
  }
}

/** Edit a specific channel message by ID */
export async function editChannelMessage(
  channelId: string,
  messageId: string,
  botToken: string,
  body: {
    content?: string
    embeds?: Array<Embed>
    components?: Array<ActionRow>
  },
): Promise<void> {
  const url = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bot ${botToken}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    console.error(`Failed to edit message: ${res.status}`, await res.text())
  }
}

/** Edit the deferred response via Discord REST API */
export async function editDeferredResponse(
  applicationId: string,
  interactionToken: string,
  body: {
    content?: string
    embeds?: Array<Embed>
    components?: Array<ActionRow>
  },
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
