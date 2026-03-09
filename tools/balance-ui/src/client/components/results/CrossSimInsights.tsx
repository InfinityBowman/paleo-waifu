import { useMemo } from 'react'
import { cn } from '../../lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { SectionTooltip } from './SectionTooltip'
import { ROLE_COLOR_VALUES } from './constants'
import type {
  CreatureFieldStats,
  MetaRunResult,
} from '../../../shared/types.ts'

interface Props {
  fieldCreatures: Array<CreatureFieldStats>
  metaResult: MetaRunResult
}

export function CrossSimInsights({ fieldCreatures, metaResult }: Props) {
  const insights = useMemo(() => {
    const fieldWrMap = new Map(fieldCreatures.map((c) => [c.name, c.winRate]))
    const metaLeaderboard = metaResult.result.creatureLeaderboard

    const crossData = metaLeaderboard
      .map((entry) => ({
        name: entry.creature.name,
        role: entry.creature.role,
        metaPresence: entry.appearances,
        metaWrDiff: entry.allTeamWinRate,
        fieldWr: fieldWrMap.get(entry.creature.name),
      }))
      .filter((d) => d.fieldWr !== undefined) as Array<{
      name: string
      role: string
      metaPresence: number
      metaWrDiff: number
      fieldWr: number
    }>

    const overrated = crossData
      .filter((d) => d.fieldWr > 0.52 && d.metaPresence <= 3)
      .sort((a, b) => b.fieldWr - a.fieldWr)
      .slice(0, 5)

    const teamDependant = crossData
      .filter((d) => d.metaPresence > 5 && d.fieldWr < 0.48)
      .sort((a, b) => b.metaPresence - a.metaPresence)
      .slice(0, 5)

    const genuinelyStrong = crossData
      .filter((d) => d.metaPresence > 5 && d.fieldWr > 0.55)
      .sort((a, b) => b.fieldWr - a.fieldWr)
      .slice(0, 5)

    return { overrated, teamDependant, genuinelyStrong, crossData }
  }, [fieldCreatures, metaResult])

  if (insights.crossData.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle>Cross-Sim Insights</CardTitle>
          <SectionTooltip>
            Compares field sim win rate (solo strength) with meta sim presence
            (how often a creature appears in evolved teams). Reveals which
            creatures are genuinely strong, which are overrated solo performers,
            and which are carried by team synergies.
          </SectionTooltip>
        </div>
        <CardDescription>
          Meta presence vs field win rate — {insights.crossData.length}{' '}
          creatures cross-referenced
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-3">
          {insights.genuinelyStrong.length > 0 && (
            <InsightColumn
              title="Genuinely Strong"
              description="High meta presence AND high field WR"
              items={insights.genuinelyStrong.map((d) => ({
                name: d.name,
                role: d.role,
                detail: `${d.metaPresence} appearances, ${(d.fieldWr * 100).toFixed(1)}% field WR`,
              }))}
              color="text-success"
            />
          )}
          {insights.overrated.length > 0 && (
            <InsightColumn
              title="Overrated"
              description="Strong solo but rarely picked in meta"
              items={insights.overrated.map((d) => ({
                name: d.name,
                role: d.role,
                detail: `${(d.fieldWr * 100).toFixed(1)}% field WR, ${d.metaPresence} appearances`,
              }))}
              color="text-warning"
            />
          )}
          {insights.teamDependant.length > 0 && (
            <InsightColumn
              title="Team Dependant"
              description="Weak solo but carried by team synergies"
              items={insights.teamDependant.map((d) => ({
                name: d.name,
                role: d.role,
                detail: `${d.metaPresence} appearances, ${(d.fieldWr * 100).toFixed(1)}% field WR`,
              }))}
              color="text-primary"
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function InsightColumn({
  title,
  description,
  items,
  color,
}: {
  title: string
  description: string
  items: Array<{ name: string; role: string; detail: string }>
  color: string
}) {
  return (
    <div>
      <div className={cn('text-xs font-semibold mb-0.5', color)}>{title}</div>
      <div className="text-[10px] text-muted-foreground mb-2">
        {description}
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div key={item.name} className="text-xs">
            <span className="font-medium">{item.name}</span>
            <span
              className="ml-1 capitalize text-[10px]"
              style={{ color: ROLE_COLOR_VALUES[item.role] }}
            >
              {item.role}
            </span>
            <div className="text-[10px] text-muted-foreground">
              {item.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
