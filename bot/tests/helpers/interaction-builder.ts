import { InteractionType } from '../../src/lib/discord'
import type { Interaction, InteractionOption } from '../../src/lib/discord'

const DEFAULT_USER = {
  id: '111111111111111111',
  username: 'testuser',
  discriminator: '0',
  avatar: null,
  global_name: 'Test User',
}

let interactionCounter = 0

function nextId(): string {
  return String(++interactionCounter).padStart(18, '0')
}

export function buildPingInteraction(): Interaction {
  return {
    id: nextId(),
    token: `test-token-${nextId()}`,
    type: InteractionType.PING,
    application_id: 'test-app-id',
  }
}

export function buildCommandInteraction(
  name: string,
  options?: {
    userId?: string
    options?: Array<InteractionOption>
  },
): Interaction {
  const userId = options?.userId ?? DEFAULT_USER.id
  return {
    id: nextId(),
    token: `test-token-${nextId()}`,
    type: InteractionType.APPLICATION_COMMAND,
    application_id: 'test-app-id',
    data: {
      id: nextId(),
      name,
      options: options?.options,
    },
    member: {
      user: {
        ...DEFAULT_USER,
        id: userId,
      },
    },
    channel_id: '999999999999999999',
  }
}

export function buildComponentInteraction(
  customId: string,
  options?: {
    userId?: string
    values?: Array<string>
    componentType?: number
  },
): Interaction {
  const userId = options?.userId ?? DEFAULT_USER.id
  return {
    id: nextId(),
    token: `test-token-${nextId()}`,
    type: InteractionType.MESSAGE_COMPONENT,
    application_id: 'test-app-id',
    data: {
      id: nextId(),
      name: '',
      custom_id: customId,
      component_type: options?.componentType ?? 2, // 2 = button, 3 = select menu
      values: options?.values,
    },
    member: {
      user: {
        ...DEFAULT_USER,
        id: userId,
      },
    },
    message: {
      id: nextId(),
      channel_id: '999999999999999999',
    },
    channel_id: '999999999999999999',
  }
}

export function resetInteractionCounter() {
  interactionCounter = 0
}
