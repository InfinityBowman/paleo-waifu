import { useState, useEffect } from 'react'
import { usePipeline } from './hooks/usePipeline'
import { PipelineGraph } from './components/PipelineGraph'
import { StageDetail } from './components/StageDetail'
import { ControlBar } from './components/ControlBar'
import { Loader2 } from 'lucide-react'

export function App() {
  const { stages, loading, hasRunning, completedCount } = usePipeline()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // Auto-select first stage on initial load
  useEffect(() => {
    if (selectedId || stages.length === 0) return
    const running = stages.find((s) => s.state.status === 'running')
    setSelectedId(running?.id ?? stages[0].id)
  }, [selectedId, stages])

  const selectedStage = stages.find((s) => s.id === selectedId) ?? null

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <ControlBar
        stages={stages}
        hasRunning={hasRunning}
        completedCount={completedCount}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="w-72 flex-shrink-0 overflow-y-auto border-r border-border">
          <PipelineGraph
            stages={stages}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div className="flex-1 overflow-hidden">
          {selectedStage ? (
            <StageDetail key={selectedStage.id} stage={selectedStage} />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              Select a stage to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
