import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { loadKeypairFromEnv } from '../helpers/crypto'
import {
  sendInteraction,
  sendUnsignedInteraction,
  sendBadSignatureInteraction,
  setWorkerUrl,
} from '../helpers/worker-client'
import { buildPingInteraction } from '../helpers/interaction-builder'
import { resetInteractionCounter } from '../helpers/interaction-builder'
import { closeDb } from '../helpers/db-seed'

beforeEach(async () => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
})

afterAll(() => closeDb())

describe('Signature verification', () => {
  it('rejects requests with missing signature headers', async () => {
    const interaction = buildPingInteraction()
    const res = await sendUnsignedInteraction(interaction)

    expect(res.status).toBe(401)
  })

  it('rejects requests with invalid signature', async () => {
    const interaction = buildPingInteraction()
    const res = await sendBadSignatureInteraction(interaction)

    expect(res.status).toBe(401)
  })

  it('accepts PING with valid signature and returns PONG', async () => {
    const interaction = buildPingInteraction()
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.type).toBe(1) // PONG
  })

  it('rejects non-POST methods', async () => {
    const res = await fetch(process.env.__TEST_WORKER_URL!, {
      method: 'GET',
    })

    expect(res.status).toBe(405)
  })
})
