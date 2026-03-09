import { useMemo } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { Sparkline } from './Sparkline'
import { ROLE_COLOR_VALUES, ROLE_ORDER } from './constants'
import type {
  CreatureRecord,
  GenerationSnapshot,
  MetaResult,
} from '../../../shared/types.ts'

export function AbilityLeaderboard({
  leaderboard,
  snapshots,
  creatures,
}: {
  leaderboard: MetaResult['abilityLeaderboard']
  snapshots: Array<GenerationSnapshot>
  creatures?: Array<CreatureRecord>
}) {
  const sparklines = useMemo(() => {
    const map = new Map<string, Array<number>>()
    for (const snap of snapshots) {
      for (const [templateId, count] of Object.entries(snap.abilityPresence)) {
        let arr = map.get(templateId)
        if (!arr) {
          arr = []
          map.set(templateId, arr)
        }
        arr.push(count)
      }
    }
    return map
  }, [snapshots])

  const abilityCreatureInfo = useMemo(() => {
    if (!creatures)
      return new Map<string, { count: number; roles: Record<string, number> }>()
    const map = new Map<
      string,
      { count: number; roles: Record<string, number> }
    >()
    for (const c of creatures) {
      for (const templateId of [
        'basic_attack',
        c.active.templateId,
        c.passive.templateId,
      ]) {
        const existing = map.get(templateId) ?? { count: 0, roles: {} }
        existing.count++
        existing.roles[c.role] = (existing.roles[c.role] ?? 0) + 1
        map.set(templateId, existing)
      }
    }
    return map
  }, [creatures])

  return (
    <div className="grid grid-cols-2 gap-6">
      {(['active', 'passive'] as const).map((type) => {
        const items = leaderboard.filter((a) => a.abilityType === type)
        const maxAppearances = Math.max(...items.map((a) => a.appearances), 1)

        return (
          <div key={type}>
            <h4 className="mb-3 text-xs font-medium capitalize text-muted-foreground">
              {type}
            </h4>
            <div className="flex flex-col gap-2.5">
              {items.map((a) => {
                const isBasicAttack = a.templateId === 'basic_attack'
                const barPct = (a.appearances / maxAppearances) * 100
                const points = sparklines.get(a.templateId) ?? []
                const info = abilityCreatureInfo.get(a.templateId)
                const creatureCount = info?.count ?? 0
                const roles = info?.roles ?? {}
                const roleTotal = Object.values(roles).reduce(
                  (s, n) => s + n,
                  0,
                )
                const roleSegments = ROLE_ORDER.filter((r) => roles[r]).map(
                  (r) => ({
                    role: r,
                    pct: (roles[r] / roleTotal) * 100,
                    color: ROLE_COLOR_VALUES[r] ?? 'oklch(0.5 0 0)',
                  }),
                )
                return (
                  <Tooltip key={a.templateId}>
                    <TooltipTrigger asChild>
                      <div className="group">
                        <div className="mb-0.5 flex items-center justify-between text-[11px]">
                          <span
                            className={`flex items-center gap-1.5 font-medium group-hover:text-primary transition-colors ${isBasicAttack ? 'italic text-muted-foreground' : ''}`}
                          >
                            {a.name}
                            {creatureCount > 0 && (
                              <span className="text-[9px] text-muted-foreground/70">
                                {creatureCount}cr
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            {points.length > 1 && (
                              <Sparkline
                                points={points}
                                color="oklch(0.65 0.03 290)"
                              />
                            )}
                            <span className="font-mono text-muted-foreground">
                              {a.appearances}
                              <span
                                className={`ml-1.5 ${a.allTeamWinRate < -0.02 ? 'text-red-400' : a.allTeamWinRate > 0.02 ? 'text-green-400' : 'text-foreground'}`}
                              >
                                {a.allTeamWinRate > 0 ? '+' : ''}
                                {(a.allTeamWinRate * 100).toFixed(1)}pp
                              </span>
                            </span>
                          </div>
                        </div>
                        <div className="relative flex h-2 w-full overflow-hidden rounded-full bg-muted">
                          {roleSegments.map((seg) => (
                            <div
                              key={seg.role}
                              className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                              style={{
                                width: `${(seg.pct / 100) * barPct}%`,
                                backgroundColor: seg.color,
                                opacity: 0.5 + a.avgFitness * 0.5,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <div className="text-[10px]">
                        <div>
                          {a.name} ({type})
                        </div>
                        <div>Appearances: {a.appearances}</div>
                        {creatureCount > 0 && (
                          <div>
                            Used by: {creatureCount} creature
                            {creatureCount !== 1 ? 's' : ''}
                            {roleSegments.length > 0 && (
                              <span>
                                {' '}
                                (
                                {roleSegments
                                  .map((s) => `${s.role} ${Math.round(s.pct)}%`)
                                  .join(', ')}
                                )
                              </span>
                            )}
                          </div>
                        )}
                        <div>
                          WR Diff: {a.allTeamWinRate > 0 ? '+' : ''}
                          {(a.allTeamWinRate * 100).toFixed(1)}pp
                        </div>
                        <div>
                          Top-Quartile Fitness:{' '}
                          {(a.avgFitness * 100).toFixed(1)}%
                        </div>
                        {points.length > 1 && (
                          <div>
                            Trend: {points[0]} → {points[points.length - 1]}
                            {points[points.length - 1] > points[0]
                              ? ' (rising)'
                              : points[points.length - 1] < points[0]
                                ? ' (falling)'
                                : ' (stable)'}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
