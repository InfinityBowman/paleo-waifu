import { execFile } from 'node:child_process'
import { mkdir, readFile, unlink } from 'node:fs/promises'
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

const SAFE_SLUG = /^[a-z0-9-]+$/

function validateSlug(slug: string): void {
  if (!SAFE_SLUG.test(slug)) {
    throw new Error(`Invalid slug: ${slug}`)
  }
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

  // Upload to prod R2 (use execFile to avoid shell injection)
  const r2Key = `creatures/${slug}.webp`
  await execFileAsync('npx', [
    'wrangler', 'r2', 'object', 'put',
    `${R2_BUCKET}/${r2Key}`,
    `--file=${webpPath}`,
    '--content-type=image/webp',
    '--remote',
  ], { cwd: PROJECT_ROOT })

  const imageUrl = `/api/images/${r2Key}`

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

  // Delete from R2 (use execFile to avoid shell injection)
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
