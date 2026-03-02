import { useState, useEffect } from 'react'
import { Play, Square, RotateCcw, Clock, Terminal, Info, ChevronDown } from 'lucide-react'
import type { StageWithState } from '../lib/types'
import { runStage, stopStage, fetchOutputBuffer, outputStreamUrl } from '../lib/api'
import { useEventSource } from '../hooks/useEventSource'
import { StatusBadge } from './StatusBadge'
import { OutputTerminal } from './OutputTerminal'
import { ArtifactList } from './ArtifactList'

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}m ${remaining}s`
}

export function StageDetail({ stage }: { stage: StageWithState }) {
  const { state } = stage
  const isRunning = state.status === 'running'

  const [showDetails, setShowDetails] = useState(false)

  // Local flag to connect SSE immediately on run, before the poll catches up
  const [streaming, setStreaming] = useState(isRunning)

  // Sync local flag with polled state
  useEffect(() => {
    setStreaming(isRunning)
  }, [isRunning])

  // User arg values — only reset when switching stages
  const [argValues, setArgValues] = useState<Record<string, unknown>>({})
  useEffect(() => {
    const defaults: Record<string, unknown> = {}
    for (const arg of stage.userArgs) {
      defaults[arg.name] = arg.default ?? (arg.type === 'boolean' ? false : '')
    }
    setArgValues(defaults)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage.id])

  // SSE connection — uses local streaming flag so it connects immediately on run
  const { lines: liveLines, clear } = useEventSource(
    streaming ? outputStreamUrl(stage.id) : null,
  )

  // Buffered output for finished/idle stages
  const [bufferedLines, setBufferedLines] = useState(liveLines)
  useEffect(() => {
    if (streaming) return
    fetchOutputBuffer(stage.id).then(setBufferedLines)
  }, [stage.id, streaming])

  // When a stage finishes, snapshot live lines into buffer
  useEffect(() => {
    if (!streaming && liveLines.length > 0) {
      setBufferedLines(liveLines)
    }
  }, [streaming, liveLines])

  const displayLines = streaming ? liveLines : bufferedLines

  const handleRun = async () => {
    clear()
    setBufferedLines([])
    await runStage(stage.id, argValues)
    // Connect SSE immediately — don't wait for the poll
    setStreaming(true)
  }

  const elapsed =
    isRunning && state.startedAt
      ? formatDuration(Date.now() - state.startedAt)
      : state.startedAt && state.finishedAt
        ? formatDuration(state.finishedAt - state.startedAt)
        : null

  return (
    <div className="flex h-full flex-col overflow-y-auto p-4">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">{stage.name}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {stage.description}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <StatusBadge status={state.status} />
          {elapsed && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock size={12} />
              {elapsed}
            </span>
          )}
          <span className="text-xs text-muted-foreground/50">
            est. {stage.estimatedDuration}
          </span>
        </div>
        {state.error && (
          <p className="mt-2 text-xs text-destructive">{state.error}</p>
        )}
        {stage.details.length > 0 && (
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info size={12} />
            <span>How it works</span>
            <ChevronDown
              size={12}
              className={`transition-transform ${showDetails ? 'rotate-180' : ''}`}
            />
          </button>
        )}
        {showDetails && (
          <ul className="mt-2 space-y-1 rounded-md border border-border bg-card/50 p-3">
            {stage.details.map((detail, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs text-muted-foreground leading-relaxed"
              >
                <span className="mt-1 h-1 w-1 flex-shrink-0 rounded-full bg-muted-foreground/40" />
                {detail}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Command preview */}
      <div className="mb-4 rounded-md border border-border bg-terminal-bg px-3 py-2">
        <div className="flex items-center gap-1.5 text-muted-foreground/50 mb-1">
          <Terminal size={12} />
          <span className="text-xs">Command</span>
        </div>
        <code className="font-mono text-xs text-terminal-text">
          {stage.command} {stage.args.join(' ')}
        </code>
      </div>

      {/* Arguments */}
      {stage.userArgs.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Arguments
          </h3>
          <div className="space-y-2">
            {stage.userArgs.map((arg) => (
              <div key={arg.name} className="flex items-center gap-3">
                {arg.type === 'boolean' ? (
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!argValues[arg.name]}
                      onChange={(e) =>
                        setArgValues((prev) => ({
                          ...prev,
                          [arg.name]: e.target.checked,
                        }))
                      }
                      disabled={isRunning}
                      className="h-4 w-4 rounded border-border accent-primary"
                    />
                    <span className="font-mono text-xs text-foreground">
                      {arg.flag || arg.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {arg.description}
                    </span>
                  </label>
                ) : (
                  <div className="flex items-center gap-2">
                    <label className="font-mono text-xs text-foreground">
                      {arg.name}:
                    </label>
                    <input
                      type="number"
                      value={argValues[arg.name] as string}
                      onChange={(e) =>
                        setArgValues((prev) => ({
                          ...prev,
                          [arg.name]: e.target.value
                            ? Number(e.target.value)
                            : '',
                        }))
                      }
                      disabled={isRunning}
                      placeholder="default"
                      className="h-7 w-24 rounded-md border border-border bg-input px-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/30"
                    />
                    <span className="text-xs text-muted-foreground">
                      {arg.description}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="mb-4 flex gap-2">
        {isRunning ? (
          <button
            onClick={() => stopStage(stage.id)}
            className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
          >
            <Square size={13} />
            Stop
          </button>
        ) : (
          <button
            onClick={handleRun}
            className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Play size={13} />
            Run
          </button>
        )}
        {!isRunning && state.status !== 'idle' && (
          <button
            onClick={handleRun}
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/80"
          >
            <RotateCcw size={13} />
            Re-run
          </button>
        )}
      </div>

      {/* Output terminal */}
      <div className="mb-4 flex-1">
        <OutputTerminal
          lines={displayLines}
          onClear={() => {
            clear()
            setBufferedLines([])
          }}
        />
      </div>

      {/* Artifacts */}
      {stage.artifacts.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Artifacts
          </h3>
          <ArtifactList stageId={stage.id} />
        </div>
      )}
    </div>
  )
}
