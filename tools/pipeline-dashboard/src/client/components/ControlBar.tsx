import { PlayCircle, StopCircle, RotateCcw } from 'lucide-react'
import type { StageWithState } from '../lib/types'
import { runPipeline, resetPipeline, stopAllStages } from '../lib/api'

export function ControlBar({
  stages,
  hasRunning,
  completedCount,
}: {
  stages: StageWithState[]
  hasRunning: boolean
  completedCount: number
}) {
  return (
    <header className="flex items-center justify-between border-b border-border bg-card/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-base font-semibold text-foreground">
          Pipeline Dashboard
        </h1>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {completedCount}/{stages.length} done
        </span>
      </div>
      <div className="flex items-center gap-2">
        {hasRunning ? (
          <button
            onClick={() => stopAllStages()}
            className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
          >
            <StopCircle size={14} />
            Stop All
          </button>
        ) : (
          <>
            <button
              onClick={() => runPipeline()}
              className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <PlayCircle size={14} />
              Run All
            </button>
            <button
              onClick={() => resetPipeline()}
              className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition-colors hover:bg-accent/80"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </>
        )}
      </div>
    </header>
  )
}
