import { CardReveal } from './CardReveal'
import { useAppStore } from '@/store/appStore'

export function PullAnimation() {
  const { pullResults, isPulling } = useAppStore()

  if (isPulling) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-card p-16">
        <div className="flex flex-col items-center gap-4">
          <div className="h-16 w-16 animate-bounce text-4xl">🥚</div>
          <p className="text-muted-foreground animate-pulse">Excavating...</p>
        </div>
      </div>
    )
  }

  if (pullResults.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border bg-card/50 p-16">
        <p className="text-muted-foreground">
          Select a banner and pull to discover creatures!
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {pullResults.map((result, idx) => (
          <CardReveal
            key={result.userCreatureId}
            result={result}
            delay={idx * 150}
          />
        ))}
      </div>
    </div>
  )
}
