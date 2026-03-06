import { useState } from 'react'
import type { MetaResult } from '../../../shared/types.ts'

export function AbilityUsageTable({
  abilityUsage,
}: {
  abilityUsage: NonNullable<MetaResult['abilityUsage']>
}) {
  const [showAll, setShowAll] = useState(false)
  const displayed = showAll ? abilityUsage : abilityUsage.slice(0, 15)
  const maxUses = Math.max(...abilityUsage.map((a) => a.uses), 1)

  return (
    <div>
      <div className={showAll ? 'max-h-100 overflow-y-auto' : ''}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card z-10">
            <tr className="border-b border-border">
              <th className="px-4 py-1.5 text-left text-muted-foreground">#</th>
              <th className="px-2 py-1.5 text-left text-muted-foreground">
                Ability
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Uses
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Total Dmg
              </th>
              <th className="px-2 py-1.5 text-right text-muted-foreground">
                Avg Dmg
              </th>
              <th className="px-4 py-1.5 text-left text-muted-foreground w-24">
                Usage
              </th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((a, i) => {
              const barPct = (a.uses / maxUses) * 100
              const isBasicAttack = a.abilityId === 'basic_attack'
              return (
                <tr
                  key={a.abilityId}
                  className={`border-b border-border/20 hover:bg-muted/30 transition-colors ${isBasicAttack ? 'bg-muted/10' : ''}`}
                >
                  <td className="px-4 py-1.5 text-muted-foreground">
                    {i + 1}
                  </td>
                  <td className="px-2 py-1.5 font-medium">
                    <span
                      className={
                        isBasicAttack
                          ? 'text-muted-foreground italic'
                          : ''
                      }
                    >
                      {a.name}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {a.uses.toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {Math.round(a.totalDamage).toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    {a.avgDamagePerUse.toFixed(1)}
                  </td>
                  <td className="px-4 py-1.5">
                    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${barPct}%`,
                          backgroundColor: isBasicAttack
                            ? 'oklch(0.55 0.05 290)'
                            : 'oklch(0.65 0.15 25)',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {abilityUsage.length > 15 && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 w-full text-center text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          {showAll
            ? 'Show top 15'
            : `Show all ${abilityUsage.length} abilities`}
        </button>
      )}
    </div>
  )
}
