import type { StageWithState } from '../lib/types'
import { StageCard } from './StageCard'

export function PipelineGraph({
  stages,
  selectedId,
  onSelect,
}: {
  stages: StageWithState[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-col gap-0 p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Pipeline Stages
      </h2>
      {stages.map((stage, i) => (
        <StageCard
          key={stage.id}
          stage={stage}
          selected={stage.id === selectedId}
          onSelect={() => onSelect(stage.id)}
          isLast={i === stages.length - 1}
        />
      ))}
    </div>
  )
}
