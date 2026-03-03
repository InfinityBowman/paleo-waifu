import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import {
  addCreature,
  findBySlug,
  getStats,
  readCreatures,
  removeCreature,
  slugify,
  updateCreature,
  VALID_RARITIES,
  type Creature,
} from './creatures'
import {
  cleanOrphanedR2Objects,
  deleteImage,
  getLocalImage,
  processAndUploadImage,
  pushExistingImageToR2,
  syncAllToR2,
  type SyncProgress,
} from './images'
import { seedDatabase } from './seed'

const app = new Hono()

app.use(
  '/*',
  cors({
    origin: ['http://localhost:4200', 'http://localhost:4100'],
  }),
)

// ─── Creatures CRUD ──────────────────────────────────────────────────

app.get('/api/creatures', async (c) => {
  const creatures = await readCreatures()
  return c.json({ creatures, stats: getStats(creatures) })
})

app.get('/api/creatures/:slug', async (c) => {
  const slug = c.req.param('slug')
  const creatures = await readCreatures()
  const creature = findBySlug(creatures, slug)
  if (!creature) return c.json({ error: 'Not found' }, 404)
  return c.json({ creature })
})

app.post('/api/creatures', async (c) => {
  const body = (await c.req.json()) as Partial<Creature>
  if (!body.name || !body.scientificName || !body.era || !body.rarity) {
    return c.json(
      { error: 'Missing required fields: name, scientificName, era, rarity' },
      400,
    )
  }

  if (!VALID_RARITIES.has(body.rarity)) {
    return c.json({ error: `Invalid rarity: ${body.rarity}` }, 400)
  }

  const creature: Creature = {
    name: body.name,
    scientificName: body.scientificName,
    era: body.era,
    period: body.period ?? null,
    diet: body.diet ?? 'Unknown',
    sizeMeters: body.sizeMeters ?? null,
    weightKg: body.weightKg ?? null,
    rarity: body.rarity,
    description: body.description ?? '',
    funFacts: body.funFacts ?? [],
    wikipediaImageUrl: body.wikipediaImageUrl ?? null,
    source: body.source ?? 'manual',
    type: body.type ?? '',
    foundIn: body.foundIn ?? null,
    nameMeaning: body.nameMeaning ?? null,
    pronunciation: body.pronunciation ?? null,
    imageAspectRatio: null,
    imageUrl: null,
  }

  try {
    await addCreature(creature)
    return c.json({ creature }, 201)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 409)
  }
})

app.put('/api/creatures/:slug', async (c) => {
  const slug = c.req.param('slug')
  const body = (await c.req.json()) as Partial<Creature>

  if (body.rarity && !VALID_RARITIES.has(body.rarity)) {
    return c.json({ error: `Invalid rarity: ${body.rarity}` }, 400)
  }

  // Don't allow overwriting computed fields via API
  delete body.imageUrl
  delete body.imageAspectRatio

  try {
    await updateCreature(slug, body)
    const creatures = await readCreatures()
    const updated = findBySlug(creatures, body.scientificName ? slugify(body.scientificName) : slug)
    return c.json({ creature: updated })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 404)
  }
})

app.delete('/api/creatures/:slug', async (c) => {
  const slug = c.req.param('slug')
  const deleteImages = c.req.query('deleteImage') === 'true'

  try {
    await removeCreature(slug)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 404)
  }

  if (deleteImages) {
    await deleteImage(slug)
  }

  return c.json({ ok: true })
})

// ─── Image Upload ────────────────────────────────────────────────────

app.post('/api/creatures/:slug/image', async (c) => {
  const slug = c.req.param('slug')
  const creatures = await readCreatures()
  if (!findBySlug(creatures, slug)) {
    return c.json({ error: 'Creature not found' }, 404)
  }

  const body = await c.req.parseBody()
  const file = body['image']
  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No image file provided' }, 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const result = await processAndUploadImage(slug, buffer)
    return c.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: `Image processing failed: ${msg}` }, 500)
  }
})

app.get('/api/creatures/:slug/image', async (c) => {
  const slug = c.req.param('slug')
  const result = await getLocalImage(slug)
  if (!result) return c.notFound()

  return new Response(new Uint8Array(result.buffer), {
    headers: { 'Content-Type': result.contentType },
  })
})

app.post('/api/creatures/:slug/push-r2', async (c) => {
  const slug = c.req.param('slug')
  try {
    await pushExistingImageToR2(slug)
    return c.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 500)
  }
})

// ─── R2 Sync ────────────────────────────────────────────────────────

app.post('/api/r2/sync', async (c) => {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      function send(progress: SyncProgress) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(progress)}\n\n`),
        )
        if (progress.done) {
          controller.close()
        }
      }

      syncAllToR2(send).catch((err) => {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ total: 0, uploaded: 0, skipped: 0, failed: 1, current: msg, errors: [msg], done: true })}\n\n`,
          ),
        )
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
})

app.post('/api/r2/clean', async (c) => {
  const result = await cleanOrphanedR2Objects()
  return c.json(result)
})

// ─── Seed ────────────────────────────────────────────────────────────

app.post('/api/seed', async (c) => {
  const { target } = (await c.req.json()) as { target: 'local' | 'prod' }
  if (target !== 'local' && target !== 'prod') {
    return c.json({ error: 'target must be "local" or "prod"' }, 400)
  }

  const result = await seedDatabase(target)
  return c.json(result)
})

// ─── Start ───────────────────────────────────────────────────────────

const port = 4100
serve({ fetch: app.fetch, port }, () => {
  console.log(`Creature Editor API running on http://localhost:${port}`)
})
