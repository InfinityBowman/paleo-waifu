import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'

const MAX_BUFFER_LINES = 5000

export interface BufferedLine {
  type: 'stdout' | 'stderr'
  line: string
}

interface ProcessEntry {
  child: ChildProcess
  output: BufferedLine[]
  emitter: EventEmitter
  killTimer?: ReturnType<typeof setTimeout>
}

export class ProcessManager {
  private processes = new Map<string, ProcessEntry>()

  run(
    stageId: string,
    command: string,
    args: string[],
    cwd: string,
  ): EventEmitter {
    if (this.processes.has(stageId)) {
      this.kill(stageId)
    }

    const emitter = new EventEmitter()
    emitter.setMaxListeners(20)

    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        FORCE_COLOR: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const output: BufferedLine[] = []

    const handleData = (stream: 'stdout' | 'stderr') => (chunk: Buffer) => {
      const text = chunk.toString()
      const parts = text.split(/\n/)
      for (const part of parts) {
        if (!part && parts.length > 1) continue
        const subParts = part.split(/\r/)
        for (const sub of subParts) {
          if (!sub.trim()) continue
          if (output.length >= MAX_BUFFER_LINES) output.shift()
          output.push({ type: stream, line: sub })
          emitter.emit(stream, sub)
        }
      }
    }

    child.stdout?.on('data', handleData('stdout'))
    child.stderr?.on('data', handleData('stderr'))

    child.on('error', (err) => {
      emitter.emit('error', err.message)
    })

    child.on('exit', (code, signal) => {
      emitter.emit('exit', { code, signal })
    })

    this.processes.set(stageId, { child, output, emitter })

    return emitter
  }

  kill(stageId: string): boolean {
    const entry = this.processes.get(stageId)
    if (!entry?.child || entry.child.killed) return false

    entry.child.kill('SIGTERM')
    entry.killTimer = setTimeout(() => {
      if (entry.child && !entry.child.killed) {
        entry.child.kill('SIGKILL')
      }
    }, 5000)

    // Clear the force-kill timer if the process exits on its own
    entry.child.once('exit', () => {
      if (entry.killTimer) {
        clearTimeout(entry.killTimer)
        entry.killTimer = undefined
      }
    })

    return true
  }

  /** Remove a finished process entry and free its buffer. */
  cleanup(stageId: string): void {
    const entry = this.processes.get(stageId)
    if (!entry) return
    if (!entry.child.killed && entry.child.exitCode === null) return // still running
    if (entry.killTimer) clearTimeout(entry.killTimer)
    entry.emitter.removeAllListeners()
    this.processes.delete(stageId)
  }

  getOutput(stageId: string): BufferedLine[] {
    return this.processes.get(stageId)?.output ?? []
  }

  getEmitter(stageId: string): EventEmitter | undefined {
    return this.processes.get(stageId)?.emitter
  }

  isRunning(stageId: string): boolean {
    const entry = this.processes.get(stageId)
    if (!entry?.child) return false
    return !entry.child.killed && entry.child.exitCode === null
  }

  getPid(stageId: string): number | undefined {
    return this.processes.get(stageId)?.child.pid
  }
}
