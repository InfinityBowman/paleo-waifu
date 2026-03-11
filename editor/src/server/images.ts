import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { deleteFromR2, listR2Keys, uploadToR2 } from './r2'
import { listCreatures, updateCreatureImage } from './creature-repo'
import type { EditorDatabase } from './db'

const SAFE_SLUG = /^[a-z0-9-]+$/

let imagesDir: string

export function initImages(dir: string) {
  imagesDir = dir
}

function validateSlug(slug: string): void {
  if (!SAFE_SLUG.test(slug)) {
    throw new Error(`Invalid slug: ${slug}`)
  }
}

export async function processAndUploadImage(
  db: EditorDatabase,
  slug: string,
  fileBuffer: Buffer,
): Promise<{ imageUrl: string; imageAspectRatio: number }> {
  validateSlug(slug)
  await mkdir(imagesDir, { recursive: true })

  const webpPath = resolve(imagesDir, `${slug}.webp`)

  const { width = 1, height = 1 } = await sharp(fileBuffer).metadata()
  const webpBuffer = await sharp(fileBuffer).webp({ quality: 85 }).toBuffer()

  // Write locally for preview
  await writeFile(webpPath, webpBuffer)

  const imageAspectRatio = Math.round((width / height) * 10000) / 10000

  // Upload to R2
  await uploadToR2(slug, webpBuffer)

  const imageUrl = `/api/images/creatures/${slug}.webp`

  // Update D1
  await updateCreatureImage(db, slug, imageUrl, imageAspectRatio)

  return { imageUrl, imageAspectRatio }
}

export async function getLocalImage(
  slug: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  validateSlug(slug)
  const webpPath = resolve(imagesDir, `${slug}.webp`)
  try {
    const buffer = await readFile(webpPath)
    return { buffer, contentType: 'image/webp' }
  } catch {
    return null
  }
}

export async function deleteImage(slug: string): Promise<void> {
  validateSlug(slug)
  const webpPath = resolve(imagesDir, `${slug}.webp`)
  try {
    await unlink(webpPath)
  } catch {
    // File may not exist locally
  }

  try {
    await deleteFromR2(`creatures/${slug}.webp`)
  } catch {
    // May not exist in R2
  }
}

export async function pushExistingImageToR2(slug: string): Promise<void> {
  validateSlug(slug)
  const webpPath = resolve(imagesDir, `${slug}.webp`)
  await access(webpPath)
  const buffer = await readFile(webpPath)
  await uploadToR2(slug, buffer)
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
  db: EditorDatabase,
  onProgress: (progress: SyncProgress) => void,
): Promise<void> {
  const creatures = await listCreatures(db)
  const total = creatures.length
  let uploaded = 0
  let skipped = 0
  let failed = 0
  const errors: Array<string> = []

  function emit(current: string, done = false) {
    onProgress({
      total,
      uploaded,
      skipped,
      failed,
      current,
      errors: [...errors],
      done,
    })
  }

  emit('Starting sync...')

  for (let i = 0; i < creatures.length; i += PARALLEL_UPLOADS) {
    const batch = creatures.slice(i, i + PARALLEL_UPLOADS)
    const results = await Promise.allSettled(
      batch.map(async (creature) => {
        const { slug } = creature
        const webpPath = resolve(imagesDir, `${slug}.webp`)

        try {
          await access(webpPath)
        } catch {
          skipped++
          emit(slug)
          return
        }

        const buffer = await readFile(webpPath)
        await uploadToR2(slug, buffer)
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

export async function listOrphanedR2Objects(
  db: EditorDatabase,
): Promise<Array<string>> {
  const creatures = await listCreatures(db)
  const validKeys = new Set(creatures.map((c) => `creatures/${c.slug}.webp`))

  const allKeys = await listR2Keys()
  return allKeys.filter((key) => !validKeys.has(key))
}

export async function deleteR2Object(key: string): Promise<void> {
  await deleteFromR2(key)
}
