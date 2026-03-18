import { spawn } from 'node:child_process'
import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import type { ChildProcess } from 'node:child_process'
import type { FullConfig } from '@playwright/test'

const WEB_DIR = resolve(import.meta.dirname, '../..')
const MIGRATIONS_DIR = resolve(WEB_DIR, 'drizzle')

let viteProcess: ChildProcess | null = null

async function waitForReady(url: string, timeoutMs = 60_000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: 'GET' })
      if (res.status < 500) return
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Vite dev server did not become ready within ${timeoutMs}ms`)
}

async function applyMigrations() {
  const files = await readdir(MIGRATIONS_DIR)
  const sqlFiles = files.filter((f) => f.endsWith('.sql')).sort()

  for (const file of sqlFiles) {
    const result = await new Promise<{ code: number; stderr: string }>(
      (res) => {
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
          ],
          { cwd: WEB_DIR, stdio: ['pipe', 'pipe', 'pipe'] },
        )
        let stderr = ''
        proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()))
        proc.on('close', (code) => res({ code: code ?? 1, stderr }))
      },
    )
    if (result.code !== 0) {
      const isIdempotencyError =
        result.stderr.includes('already exists') ||
        result.stderr.includes('duplicate column') ||
        result.stderr.includes('SQLITE_ERROR')
      if (!isIdempotencyError) {
        throw new Error(`Migration ${file} failed: ${result.stderr}`)
      }
    }
  }
}

async function readAuthSecret(): Promise<string> {
  for (const filename of ['.dev.vars', '.env']) {
    try {
      const content = await readFile(join(WEB_DIR, filename), 'utf-8')
      const match = content.match(/^AUTH_SECRET=(.+)$/m)
      if (match) return match[1].trim()
    } catch {
      // File doesn't exist
    }
  }
  throw new Error('AUTH_SECRET not found in .dev.vars or .env')
}

export default async function globalSetup(_config: FullConfig) {
  const authSecret = await readAuthSecret()

  const port = 4000 + Math.floor(Math.random() * 1000)
  const workerUrl = `http://localhost:${port}`

  viteProcess = spawn('npx', ['vite', 'dev', '--port', String(port)], {
    cwd: WEB_DIR,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NO_D1_WARNING: 'true' },
  })

  viteProcess.stdout?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg) console.log(`[vite] ${msg}`)
  })
  viteProcess.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg && !msg.includes('ExperimentalWarning')) {
      console.error(`[vite:err] ${msg}`)
    }
  })

  await waitForReady(workerUrl)
  await applyMigrations()

  // Store for tests to read
  process.env.__TEST_WORKER_URL = workerUrl
  process.env.__TEST_AUTH_SECRET = authSecret

  return () => {
    viteProcess?.kill('SIGTERM')
    viteProcess = null
  }
}
