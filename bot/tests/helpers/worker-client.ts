import { signPayload } from './crypto'
import type { Interaction } from '../../src/lib/discord'

let workerUrl: string

export function setWorkerUrl(url: string) {
  workerUrl = url
}

export async function sendInteraction(
  interaction: Interaction,
): Promise<Response> {
  const body = JSON.stringify(interaction)
  const timestamp = String(Math.floor(Date.now() / 1000))
  const signature = await signPayload(timestamp, body)

  return fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature-Ed25519': signature,
      'X-Signature-Timestamp': timestamp,
    },
    body,
  })
}

/** Send a request without signature headers (should fail verification) */
export async function sendUnsignedInteraction(
  interaction: Interaction,
): Promise<Response> {
  return fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(interaction),
  })
}

/** Send a request with an invalid signature */
export async function sendBadSignatureInteraction(
  interaction: Interaction,
): Promise<Response> {
  return fetch(workerUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature-Ed25519': '0'.repeat(128),
      'X-Signature-Timestamp': String(Math.floor(Date.now() / 1000)),
    },
    body: JSON.stringify(interaction),
  })
}

export async function sendXpRequest(
  discordUserId: string,
  token = 'test-xp-secret',
): Promise<Response> {
  return fetch(`${workerUrl}/api/xp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ discordUserId }),
  })
}
