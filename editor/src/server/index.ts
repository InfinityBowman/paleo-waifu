import 'dotenv/config'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { toSlug } from '@paleo-waifu/shared/slug'
import { loadEnv } from './env'
import { createEditorDb } from './db'
import { initR2 } from './r2'
import { createAuthRoutes, initAuth, requireAuth } from './auth'
import {
  deleteImage,
  deleteR2Object,
  getLocalImage,
  initImages,
  listOrphanedR2Objects,
  processAndUploadImage,
  pushExistingImageToR2,
  syncAllToR2,
} from './images'
import {
  VALID_RARITIES,
  deleteCreatureBySlug,
  getCreatureBySlug,
  getStats,
  insertCreature,
  listCreatures,
  updateCreatureBySlug,
} from './creature-repo'
import type { EditorUser } from './auth'
import type { EditorDatabase } from './db'
import type { Creature } from './creature-repo'
import type { SyncProgress } from './images'

// ─── Init ────────────────────────────────────────────────────────────

const editorEnv = loadEnv()
const db = createEditorDb(editorEnv)
initR2(editorEnv)
initImages(editorEnv.IMAGES_DIR)

const app = new Hono<{ Variables: { user: EditorUser; db: EditorDatabase } }>()

// CORS only in dev
if (editorEnv.NODE_ENV !== 'production') {
  app.use(
    '/*',
    cors({
      origin: ['http://localhost:4200', 'http://localhost:4100'],
      credentials: true,
    }),
  )
}

// ─── Auth routes (unprotected) ───────────────────────────────────────

initAuth(editorEnv, db)
const authRoutes = createAuthRoutes()
app.route('/auth', authRoutes)

// ─── Auth middleware for API routes ──────────────────────────────────

app.use('/api/*', requireAuth)

// Inject db into context
app.use('/api/*', async (c, next) => {
  c.set('db', db)
  await next()
})

// ─── User info ───────────────────────────────────────────────────────

app.get('/api/me', (c) => {
  return c.json({ user: c.get('user') })
})

// ─── Creatures CRUD ──────────────────────────────────────────────────

app.get('/api/creatures', async (c) => {
  const creatures = await listCreatures(c.get('db'))
  return c.json({ creatures, stats: getStats(creatures) })
})

app.get('/api/creatures/:slug', async (c) => {
  const slug = c.req.param('slug')
  const creature = await getCreatureBySlug(c.get('db'), slug)
  if (!creature) return c.json({ error: 'Not found' }, 404)
  return c.json({ creature })
})

app.post('/api/creatures', async (c) => {
  const body = await c.req.json()
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
    slug: toSlug(body.name),
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
    const created = await insertCreature(c.get('db'), creature)
    return c.json({ creature: created }, 201)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 409)
  }
})

app.put('/api/creatures/:slug', async (c) => {
  const slug = c.req.param('slug')
  const body = await c.req.json()

  if (body.rarity && !VALID_RARITIES.has(body.rarity)) {
    return c.json({ error: `Invalid rarity: ${body.rarity}` }, 400)
  }

  // Don't allow overwriting computed fields via API
  delete body.imageUrl
  delete body.imageAspectRatio

  try {
    await updateCreatureBySlug(c.get('db'), slug, body)
    const updated = await getCreatureBySlug(
      c.get('db'),
      body.name ? toSlug(body.name) : slug,
    )
    return c.json({ creature: updated })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const status = msg.includes('not found') ? 404 : 409
    return c.json({ error: msg }, status)
  }
})

app.delete('/api/creatures/:slug', async (c) => {
  const slug = c.req.param('slug')
  const deleteImages = c.req.query('deleteImage') === 'true'

  try {
    await deleteCreatureBySlug(c.get('db'), slug)
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
  const creature = await getCreatureBySlug(c.get('db'), slug)
  if (!creature) {
    return c.json({ error: 'Creature not found' }, 404)
  }

  const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB
  const ALLOWED_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ])

  const body = await c.req.parseBody()
  const file = body['image']
  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No image file provided' }, 400)
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File too large (max 20 MB)' }, 413)
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return c.json(
      { error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' },
      415,
    )
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const result = await processAndUploadImage(c.get('db'), slug, buffer)
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

// ─── R2 Sync ─────────────────────────────────────────────────────────

app.post('/api/r2/sync', (c) => {
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

      syncAllToR2(c.get('db'), send).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              total: 0,
              uploaded: 0,
              skipped: 0,
              failed: 1,
              current: msg,
              errors: [msg],
              done: true,
            })}\n\n`,
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

app.get('/api/r2/orphans', async (c) => {
  const orphans = await listOrphanedR2Objects(c.get('db'))
  return c.json({ orphans })
})

app.delete('/api/r2/orphans/:key{.+}', async (c) => {
  const key = c.req.param('key')
  if (!key.startsWith('creatures/') || !key.endsWith('.webp')) {
    return c.json({ error: 'Invalid key' }, 400)
  }
  try {
    await deleteR2Object(key)
    return c.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return c.json({ error: msg }, 500)
  }
})

// ─── Static files (production) ───────────────────────────────────────

if (editorEnv.NODE_ENV === 'production') {
  app.use('*', serveStatic({ root: './dist/client' }))
  // SPA fallback
  app.get('*', serveStatic({ root: './dist/client', path: 'index.html' }))
}

// ─── Start ───────────────────────────────────────────────────────────

const port = editorEnv.PORT
serve({ fetch: app.fetch, port }, () => {
  console.log(`Creature Editor API running on http://localhost:${port}`)
})
