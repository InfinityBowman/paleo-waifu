import { execFile } from 'node:child_process'
import { access, mkdir, readFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'
import {
  IMAGES_DIR,
  readCreatures,
  slugify,
  updateCreature,
} from './creatures'

const execFileAsync = promisify(execFile)

const PROJECT_ROOT = resolve(import.meta.dirname, '../../../..')
const R2_BUCKET = 'paleo-waifu-images-prod'
const CACHE_CONTROL = 'public,max-age=31536000,immutable'

const SAFE_SLUG = /^[a-z0-9-]+$/

function validateSlug(slug: string): void {
  if (!SAFE_SLUG.test(slug)) {
    throw new Error(`Invalid slug: ${slug}`)
  }
}

async function uploadToR2(slug: string, filePath: string): Promise<void> {
  const r2Key = `creatures/${slug}.webp`
  await execFileAsync('npx', [
    'wrangler', 'r2', 'object', 'put',
    `${R2_BUCKET}/${r2Key}`,
    `--file=${filePath}`,
    '--content-type=image/webp',
    `--cache-control=${CACHE_CONTROL}`,
    '--remote',
  ], { cwd: PROJECT_ROOT })
}

export async function processAndUploadImage(
  slug: string,
  fileBuffer: Buffer,
): Promise<{ imageUrl: string; imageAspectRatio: number }> {
  validateSlug(slug)
  await mkdir(IMAGES_DIR, { recursive: true })

  const webpPath = resolve(IMAGES_DIR, `${slug}.webp`)

  // Get dimensions from input before converting
  const { width = 1, height = 1 } = await sharp(fileBuffer).metadata()

  // Convert to WebP
  await sharp(fileBuffer).webp({ quality: 85 }).toFile(webpPath)
  const imageAspectRatio = Math.round((width / height) * 10000) / 10000

  await uploadToR2(slug, webpPath)

  const imageUrl = `/api/images/creatures/${slug}.webp`

  // Atomically update creature in JSON
  await updateCreature(slug, { imageUrl, imageAspectRatio })

  return { imageUrl, imageAspectRatio }
}

export async function getLocalImage(
  slug: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  validateSlug(slug)
  const webpPath = resolve(IMAGES_DIR, `${slug}.webp`)
  try {
    const buffer = await readFile(webpPath)
    return { buffer, contentType: 'image/webp' }
  } catch {
    return null
  }
}

export async function deleteImage(slug: string): Promise<void> {
  validateSlug(slug)
  const webpPath = resolve(IMAGES_DIR, `${slug}.webp`)
  try {
    await unlink(webpPath)
  } catch {
    // File may not exist
  }

  const r2Key = `creatures/${slug}.webp`
  try {
    await execFileAsync('npx', [
      'wrangler', 'r2', 'object', 'delete',
      `${R2_BUCKET}/${r2Key}`,
      '--remote',
    ], { cwd: PROJECT_ROOT })
  } catch {
    // May not exist in R2
  }
}

export async function pushExistingImageToR2(slug: string): Promise<void> {
  validateSlug(slug)
  const webpPath = resolve(IMAGES_DIR, `${slug}.webp`)
  await access(webpPath)
  await uploadToR2(slug, webpPath)
}

// ─── Bulk Operations ─────────────────────────────────────────────────

const PARALLEL_UPLOADS = 4

export interface SyncProgress {
  total: number
  uploaded: number
  skipped: number
  failed: number
  current: string
  errors: Array<string>
  done: boolean
}

export async function syncAllToR2(
  onProgress: (progress: SyncProgress) => void,
): Promise<void> {
  const creatures = await readCreatures()
  const total = creatures.length
  let uploaded = 0
  let skipped = 0
  let failed = 0
  const errors: Array<string> = []

  function emit(current: string, done = false) {
    onProgress({ total, uploaded, skipped, failed, current, errors: [...errors], done })
  }

  emit('Starting sync...')

  for (let i = 0; i < creatures.length; i += PARALLEL_UPLOADS) {
    const batch = creatures.slice(i, i + PARALLEL_UPLOADS)
    const results = await Promise.allSettled(
      batch.map(async (creature) => {
        const slug = slugify(creature.scientificName)
        const webpPath = resolve(IMAGES_DIR, `${slug}.webp`)

        try {
          await access(webpPath)
        } catch {
          skipped++
          emit(slug)
          return
        }

        await uploadToR2(slug, webpPath)
        uploaded++
        emit(slug)
      }),
    )

    for (const result of results) {
      if (result.status === 'rejected') {
        failed++
        const msg = result.reason?.message ?? String(result.reason)
        errors.push(msg)
        emit(msg)
      }
    }
  }

  emit('Done', true)
}

export async function cleanOrphanedR2Objects(): Promise<{
  deleted: number
  errors: Array<string>
}> {
  const creatures = await readCreatures()
  const validKeys = new Set(
    creatures.map((c) => `creatures/${slugify(c.scientificName)}.webp`),
  )

  // List all objects in the bucket
  let allKeys: Array<string> = []
  try {
    const { stdout } = await execFileAsync('npx', [
      'wrangler', 'r2', 'object', 'list', R2_BUCKET,
      '--remote',
    ], { cwd: PROJECT_ROOT })

    // wrangler outputs JSON array of objects
    const objects = JSON.parse(stdout) as Array<{ key: string }>
    allKeys = objects.map((o) => o.key)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { deleted: 0, errors: [`Failed to list R2 objects: ${msg}`] }
  }

  const orphaned = allKeys.filter((key) => !validKeys.has(key))
  let deleted = 0
  const errors: Array<string> = []

  for (const key of orphaned) {
    try {
      await execFileAsync('npx', [
        'wrangler', 'r2', 'object', 'delete',
        `${R2_BUCKET}/${key}`,
        '--remote',
      ], { cwd: PROJECT_ROOT })
      deleted++
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Failed to delete ${key}: ${msg}`)
    }
  }

  return { deleted, errors }
}
