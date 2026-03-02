import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { serve } from '@hono/node-server'
import { resolve } from 'node:path'
import { stat, readdir } from 'node:fs/promises'
import { stages, getStage, getExecutionOrder, type StageState } from './pipeline.js'
import { ProcessManager } from './process-manager.js'

const app = new Hono()
const processManager = new ProcessManager()
const stageStates = new Map<string, StageState>()

const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..', '..', '..')

for (const stage of stages) {
  stageStates.set(stage.id, { status: 'idle' })
}

app.use('*', cors())

// --- Helpers ---

function buildArgs(stageId: string, userArgs: Record<string, unknown>): string[] {
  const stage = getStage(stageId)
  if (!stage) return []

  const args = [...stage.args]

  // seed-db remote toggle swaps the pnpm script name
  if (stageId === 'seed-db' && userArgs['remote']) {
    args[0] = 'db:seed:prod'
  }

  for (const argDef of stage.userArgs) {
    const value = userArgs[argDef.name]
    if (value === undefined || value === false) continue

    if (argDef.type === 'boolean' && value === true && argDef.flag) {
      args.push(argDef.flag)
    } else if (argDef.type === 'number' && typeof value === 'number') {
      if (argDef.flag) {
        args.push(argDef.flag, String(value))
      } else {
        args.push(String(value))
      }
    }
  }

  return args
}

function startStage(stageId: string, args: string[], cwd: string): void {
  stageStates.set(stageId, {
    status: 'running',
    startedAt: Date.now(),
    pid: processManager.getPid(stageId),
  })

  const emitter = processManager.run(stageId, getStage(stageId)!.command, args, cwd)

  // PID is available synchronously after spawn
  const state = stageStates.get(stageId)!
  state.pid = processManager.getPid(stageId)

  emitter.on('exit', ({ code }: { code: number | null }) => {
    const s = stageStates.get(stageId)
    if (s) {
      s.status = code === 0 ? 'success' : 'failed'
      s.exitCode = code
      s.finishedAt = Date.now()
    }
  })

  emitter.on('error', (message: string) => {
    const s = stageStates.get(stageId)
    if (s) {
      s.status = 'failed'
      s.error = message
      s.finishedAt = Date.now()
    }
  })
}

// --- Routes ---

// GET /api/pipeline — full DAG + status
app.get('/api/pipeline', (c) => {
  const pipeline = stages.map((stage) => ({
    ...stage,
    state: stageStates.get(stage.id) ?? { status: 'idle' },
  }))
  return c.json({ stages: pipeline })
})

// POST /api/stages/:id/run
app.post('/api/stages/:id/run', async (c) => {
  const stageId = c.req.param('id')
  const stage = getStage(stageId)
  if (!stage) return c.json({ error: 'Stage not found' }, 404)
  if (processManager.isRunning(stageId)) {
    return c.json({ error: 'Stage already running' }, 409)
  }

  // Clean up previous run's process entry
  processManager.cleanup(stageId)

  const body = await c.req.json().catch(() => ({}))
  const args = buildArgs(stageId, body.args ?? {})
  startStage(stageId, args, stage.cwd)

  return c.json({ ok: true, stageId })
})

// POST /api/stages/:id/stop
app.post('/api/stages/:id/stop', (c) => {
  const stageId = c.req.param('id')
  const killed = processManager.kill(stageId)
  if (!killed) return c.json({ error: 'Stage not running' }, 409)

  const state = stageStates.get(stageId)
  if (state) {
    state.status = 'failed'
    state.error = 'Killed by user'
    state.finishedAt = Date.now()
  }
  return c.json({ ok: true })
})

// GET /api/stages/:id/output — SSE stream
app.get('/api/stages/:id/output', (c) => {
  const stageId = c.req.param('id')

  return streamSSE(c, async (stream) => {
    // Replay buffered output
    for (const { type, line } of processManager.getOutput(stageId)) {
      await stream.writeSSE({
        event: type,
        data: JSON.stringify({ line, ts: Date.now() }),
      })
    }

    // Send current status
    const state = stageStates.get(stageId) ?? { status: 'idle' }
    await stream.writeSSE({
      event: 'status',
      data: JSON.stringify(state),
    })

    if (state.status !== 'running') return

    const emitter = processManager.getEmitter(stageId)
    if (!emitter) return

    let done = false

    const onStdout = async (line: string) => {
      if (done) return
      try {
        await stream.writeSSE({
          event: 'stdout',
          data: JSON.stringify({ line, ts: Date.now() }),
        })
      } catch {
        done = true
      }
    }

    const onStderr = async (line: string) => {
      if (done) return
      try {
        await stream.writeSSE({
          event: 'stderr',
          data: JSON.stringify({ line, ts: Date.now() }),
        })
      } catch {
        done = true
      }
    }

    const onExit = async ({ code }: { code: number | null }) => {
      if (done) return
      done = true
      const finalState = stageStates.get(stageId) ?? { status: 'idle' }
      try {
        await stream.writeSSE({
          event: 'status',
          data: JSON.stringify({ ...finalState, exitCode: code }),
        })
      } catch {
        // stream already closed
      }
    }

    emitter.on('stdout', onStdout)
    emitter.on('stderr', onStderr)
    emitter.on('exit', onExit)

    const heartbeat = setInterval(async () => {
      if (done) {
        clearInterval(heartbeat)
        return
      }
      try {
        await stream.writeSSE({ event: 'heartbeat', data: '' })
      } catch {
        done = true
        clearInterval(heartbeat)
      }
    }, 15000)

    await new Promise<void>((resolve) => {
      if (done) return resolve()
      emitter.once('exit', () => setTimeout(resolve, 100))
    })

    clearInterval(heartbeat)
    emitter.off('stdout', onStdout)
    emitter.off('stderr', onStderr)
    emitter.off('exit', onExit)
  })
})

// GET /api/stages/:id/output/buffer — JSON snapshot of buffered output
app.get('/api/stages/:id/output/buffer', (c) => {
  const stageId = c.req.param('id')
  return c.json({ lines: processManager.getOutput(stageId) })
})

// GET /api/stages/:id/artifacts
app.get('/api/stages/:id/artifacts', async (c) => {
  const stageId = c.req.param('id')
  const stage = getStage(stageId)
  if (!stage) return c.json({ error: 'Stage not found' }, 404)

  const artifacts = []

  for (const spec of stage.artifacts) {
    const fullPath = resolve(PROJECT_ROOT, spec.path)

    try {
      const stats = await stat(fullPath)

      if (stats.isDirectory() && spec.glob) {
        const files = await readdir(fullPath)
        const matching = spec.glob.endsWith('*.webp')
          ? files.filter((f) => f.endsWith('.webp'))
          : files
        const totalSize = await Promise.all(
          matching.map(async (f) => {
            try {
              const s = await stat(resolve(fullPath, f))
              return s.size
            } catch {
              return 0
            }
          }),
        ).then((sizes) => sizes.reduce((a, b) => a + b, 0))

        artifacts.push({
          path: spec.path,
          description: spec.description,
          type: 'directory' as const,
          fileCount: matching.length,
          totalSize,
          modifiedAt: stats.mtimeMs,
        })
      } else if (stats.isFile()) {
        artifacts.push({
          path: spec.path,
          description: spec.description,
          type: 'file' as const,
          size: stats.size,
          modifiedAt: stats.mtimeMs,
        })
      }
    } catch {
      artifacts.push({
        path: spec.path,
        description: spec.description,
        type: 'missing' as const,
      })
    }
  }

  return c.json({ artifacts })
})

// POST /api/pipeline/run
app.post('/api/pipeline/run', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const order = getExecutionOrder(body.fromStage)

  for (const id of order) {
    if (processManager.isRunning(id)) {
      return c.json({ error: `Stage ${id} is already running` }, 409)
    }
  }

  runPipelineSequence(order, body.argsMap ?? {})
  return c.json({ ok: true, stages: order })
})

// POST /api/pipeline/reset
app.post('/api/pipeline/reset', (c) => {
  for (const stage of stages) {
    if (!processManager.isRunning(stage.id)) {
      processManager.cleanup(stage.id)
      stageStates.set(stage.id, { status: 'idle' })
    }
  }
  return c.json({ ok: true })
})

// POST /api/pipeline/stop
app.post('/api/pipeline/stop', (c) => {
  pipelineAbort = true

  for (const stage of stages) {
    if (processManager.isRunning(stage.id)) {
      processManager.kill(stage.id)
      const state = stageStates.get(stage.id)
      if (state) {
        state.status = 'failed'
        state.error = 'Pipeline stopped by user'
        state.finishedAt = Date.now()
      }
    }
  }
  return c.json({ ok: true })
})

// --- Pipeline runner ---

let pipelineAbort = false

async function runPipelineSequence(
  order: string[],
  argsMap: Record<string, Record<string, unknown>>,
) {
  pipelineAbort = false

  for (const stageId of order) {
    if (pipelineAbort) break

    const stage = getStage(stageId)
    if (!stage) continue

    const allDepsOk = stage.dependsOn.every(
      (dep) => stageStates.get(dep)?.status === 'success',
    )

    if (stage.dependsOn.length > 0 && !allDepsOk) {
      stageStates.set(stageId, {
        status: 'failed',
        error: 'Dependency not met',
        finishedAt: Date.now(),
      })
      continue
    }

    processManager.cleanup(stageId)
    const args = buildArgs(stageId, argsMap[stageId] ?? {})
    startStage(stageId, args, stage.cwd)

    const emitter = processManager.getEmitter(stageId)
    const exitCode = await new Promise<number | null>((resolve) => {
      emitter?.once('exit', ({ code }: { code: number | null }) => resolve(code))
      emitter?.once('error', () => resolve(1))
    })

    if (exitCode !== 0) break
  }
}

// --- Server ---

const port = 4100
console.log(`Pipeline dashboard API running on http://localhost:${port}`)

serve({ fetch: app.fetch, port })
