import { spawn, type ChildProcess } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { generateAndShareKeypair, getPublicKeyHex } from './helpers/crypto'

const BOT_DIR = resolve(import.meta.dirname, '..')
const WRANGLER_STATE_DIR = join(
  BOT_DIR,
  '.wrangler/state/v3/d1/miniflare-D1DatabaseObject',
)
const MIGRATIONS_DIR = resolve(BOT_DIR, '../web/drizzle')

let workerProcess: ChildProcess | null = null
let workerUrl: string

async function waitForReady(
  url: string,
  timeoutMs = 30_000,
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' })
      // Worker responds 405 to GET — that means it's up
      if (res.status === 405) return
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Worker did not become ready within ${timeoutMs}ms`)
}

async function applyMigrations(port: number) {
  const files = await readdir(MIGRATIONS_DIR)
  const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort()

  for (const file of sqlFiles) {
    const result = await new Promise<{ code: number; stderr: string }>(
      (resolve) => {
        const proc = spawn(
          'npx',
          [
            'wrangler',
            'd1',
            'execute',
            'paleo-waifu-db',
            '--local',
            '--file',
            join(MIGRATIONS_DIR, file),
            '-c',
            'wrangler.jsonc',
          ],
          { cwd: BOT_DIR, stdio: ['pipe', 'pipe', 'pipe'] },
        )
        let stderr = ''
        proc.stderr?.on('data', (d) => (stderr += d.toString()))
        proc.on('close', (code) => resolve({ code: code ?? 1, stderr }))
      },
    )
    if (result.code !== 0) {
      // Ignore "already exists" errors from re-running migrations
      if (!result.stderr.includes('already exists')) {
        console.error(`Migration ${file} failed:`, result.stderr)
      }
    }
  }
}

export async function findDbPath(): Promise<string> {
  const files = await readdir(WRANGLER_STATE_DIR)
  const sqlite = files.find((f) => f.endsWith('.sqlite'))
  if (!sqlite) throw new Error('No D1 SQLite file found')
  return join(WRANGLER_STATE_DIR, sqlite)
}

export async function setup() {
  // Generate test keypair and share via env
  await generateAndShareKeypair()
  const publicKeyHex = getPublicKeyHex()

  // Pick a random port to avoid conflicts
  const port = 8787 + Math.floor(Math.random() * 1000)
  workerUrl = `http://localhost:${port}`

  // Start wrangler dev with test env vars
  workerProcess = spawn(
    'npx',
    [
      'wrangler',
      'dev',
      '-c',
      'wrangler.jsonc',
      '--port',
      String(port),
      '--var',
      `DISCORD_PUBLIC_KEY:${publicKeyHex}`,
      '--var',
      'DISCORD_APPLICATION_ID:test-app-id',
      '--var',
      'DISCORD_BOT_TOKEN:test-token',
      '--var',
      'XP_API_SECRET:test-xp-secret',
    ],
    {
      cwd: BOT_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NO_D1_WARNING: 'true' },
    },
  )

  // Log worker output for debugging
  workerProcess.stdout?.on('data', (data) => {
    const msg = data.toString().trim()
    if (msg) console.log(`[worker] ${msg}`)
  })
  workerProcess.stderr?.on('data', (data) => {
    const msg = data.toString().trim()
    if (msg && !msg.includes('ExperimentalWarning')) {
      console.error(`[worker:err] ${msg}`)
    }
  })

  // Wait for worker to be ready
  await waitForReady(workerUrl)

  // Apply D1 migrations
  await applyMigrations(port)

  // Provide worker URL to tests via env
  process.env.__TEST_WORKER_URL = workerUrl

  return () => {
    workerProcess?.kill('SIGTERM')
    workerProcess = null
  }
}
