import { entries } from './constants'

export function SynergyBars({
  synergyShares,
}: {
  synergyShares: Record<string, number>
}) {
  const sorted = entries(synergyShares).sort(([, a], [, b]) => b - a)
  const maxShare = Math.max(...sorted.map(([, s]) => s), 0.01)

  return (
    <div className="flex flex-col gap-2">
      {sorted.map(([synergy, share]) => {
        const barPct = (share / maxShare) * 100
        return (
          <div key={synergy}>
            <div className="mb-0.5 flex items-center justify-between text-[11px]">
              <span className="font-medium">{synergy}</span>
              <span className="font-mono text-muted-foreground">
                {(share * 100).toFixed(1)}%
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${barPct}%`,
                  backgroundColor: 'oklch(0.7 0.17 300)',
                  opacity: 0.4 + share * 0.6,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
