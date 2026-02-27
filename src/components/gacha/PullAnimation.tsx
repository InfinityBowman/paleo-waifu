import { useMemo } from 'react'
import { Pickaxe, X } from 'lucide-react'
import { CardReveal } from './CardReveal'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/appStore'

function DustParticle({ delay, left }: { delay: string; left: number }) {
  return (
    <div
      className="absolute bottom-8 text-xs text-muted-foreground/50"
      style={{
        animation: 'particle-rise 1.5s ease-out infinite',
        animationDelay: delay,
        left: `${left}%`,
      }}
    >
      .
    </div>
  )
}

export function PullAnimation() {
  const { pullResults, isPulling, clearPullResults } = useAppStore()

  // Stable random positions for dust particles — computed once per mount
  const dustPositions = useMemo(
    () => [30, 40, 50, 60].map((base) => base + ((base * 7) % 10)),
    [],
  )

  if (isPulling) {
    return (
      <div className="relative flex items-center justify-center rounded-xl border bg-gradient-to-b from-card to-card/80 p-16">
        <div className="absolute inset-0 rounded-xl bg-[radial-gradient(ellipse_at_center,oklch(0.75_0.16_75/0.06)_0%,transparent_70%)]" />
        <div className="relative flex flex-col items-center gap-4">
          <div className="animate-dig text-4xl">
            <Pickaxe className="h-12 w-12 text-primary" />
          </div>
          <p className="font-display text-lg text-muted-foreground">
            Excavating
            <span className="inline-flex w-6">
              <span
                className="animate-bounce"
                style={{ animationDelay: '0ms' }}
              >
                .
              </span>
              <span
                className="animate-bounce"
                style={{ animationDelay: '150ms' }}
              >
                .
              </span>
              <span
                className="animate-bounce"
                style={{ animationDelay: '300ms' }}
              >
                .
              </span>
            </span>
          </p>
          {/* Dust particles */}
          <DustParticle delay="0s" left={dustPositions[0]} />
          <DustParticle delay="0.3s" left={dustPositions[1]} />
          <DustParticle delay="0.6s" left={dustPositions[2]} />
          <DustParticle delay="0.9s" left={dustPositions[3]} />
        </div>
      </div>
    )
  }

  if (pullResults.length === 0) {
    return null
  }

  const isSingle = pullResults.length === 1

  return (
    <div className="relative rounded-xl border bg-gradient-to-b from-card to-card/90 p-6">
      <button
        onClick={clearPullResults}
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div
        className={cn(
          'grid gap-4',
          isSingle
            ? 'mx-auto max-w-[180px]'
            : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
        )}
      >
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
