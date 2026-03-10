import { beforeEach, describe, expect, it } from 'vitest'
import { loadKeypairFromEnv } from '../helpers/crypto'
import { sendInteraction, setWorkerUrl } from '../helpers/worker-client'
import {
  buildCommandInteraction,
  resetInteractionCounter,
} from '../helpers/interaction-builder'

beforeEach(() => {
  loadKeypairFromEnv()
  setWorkerUrl(process.env.__TEST_WORKER_URL!)
  resetInteractionCounter()
})

describe('/help', () => {
  it('returns ephemeral response with command list', async () => {
    const interaction = buildCommandInteraction('help')
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.type).toBe(4) // CHANNEL_MESSAGE_WITH_SOURCE
    expect(body.data.flags).toBe(64) // EPHEMERAL

    // Help should mention key commands
    const content = body.data.content ?? ''
    const embedText =
      body.data.embeds
        ?.map((e: { description?: string }) => e.description ?? '')
        .join(' ') ?? ''
    const fullText = content + embedText

    expect(fullText).toContain('pull')
    expect(fullText).toContain('daily')
    expect(fullText).toContain('balance')
  })

  it('does not require auth (unlinked user can call /help)', async () => {
    const interaction = buildCommandInteraction('help', {
      userId: '000000000000000000', // Unlinked user
    })
    const res = await sendInteraction(interaction)

    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    // Should NOT be the "link your account" message
    expect(body.type).toBe(4)
    expect(body.data.content ?? '').not.toContain('link')
  })
})
