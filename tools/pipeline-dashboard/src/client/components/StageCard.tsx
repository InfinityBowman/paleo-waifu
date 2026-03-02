import { Play, Square } from 'lucide-react'
import type { StageWithState } from '../lib/types'
import { StatusBadge } from './StatusBadge'
import { runStage, stopStage } from '../lib/api'

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${minutes}m ${remaining}s`
}

export function StageCard({
  stage,
  selected,
  onSelect,
  isLast,
}: {
  stage: StageWithState
  selected: boolean
  onSelect: () => void
  isLast: boolean
}) {
  const { state } = stage
  const isRunning = state.status === 'running'
  const elapsed =
    isRunning && state.startedAt
      ? formatDuration(Date.now() - state.startedAt)
      : state.startedAt && state.finishedAt
        ? formatDuration(state.finishedAt - state.startedAt)
        : null

  const handleRun = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await runStage(stage.id)
  }

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await stopStage(stage.id)
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={onSelect}
        className={`
          w-full rounded-lg border px-3 py-2.5 text-left transition-all
          ${
            selected
              ? 'border-primary/30 bg-primary/5'
              : 'border-border bg-card hover:border-primary/15 hover:bg-card/80'
          }
        `}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <StatusBadge status={state.status} showLabel={false} size={14} />
              <span className="truncate text-sm font-medium text-foreground">
                {stage.name}
              </span>
            </div>
            {elapsed && (
              <span className="ml-5.5 text-xs text-muted-foreground">
                {elapsed}
              </span>
            )}
          </div>
          {isRunning ? (
            <button
              onClick={handleStop}
              className="flex-shrink-0 rounded-md p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
              title="Stop"
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleRun}
              className="flex-shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              title="Run"
            >
              <Play size={14} />
            </button>
          )}
        </div>
      </button>
      {!isLast && (
        <div className="connector-line h-4 flex-shrink-0" />
      )}
    </div>
  )
}
