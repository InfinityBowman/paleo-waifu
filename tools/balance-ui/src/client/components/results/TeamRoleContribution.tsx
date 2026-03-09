import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { SectionTooltip } from './SectionTooltip'
import {
  ROLE_COLOR_VALUES,
  TOOLTIP_CONTENT_STYLE,
  TOOLTIP_ITEM_STYLE,
  TOOLTIP_LABEL_STYLE,
} from './constants'
import type { TeamRoleMatchup } from '../../../shared/types.ts'

interface Props {
  roles: Array<TeamRoleMatchup>
}

export function TeamRoleContribution({ roles }: Props) {
  const data = useMemo(
    () =>
      [...roles]
        .sort((a, b) => b.winRate - a.winRate)
        .map((r) => ({
          role: r.role,
          winRate: Math.round(r.winRate * 1000) / 10,
          sampleSize: r.sampleSize,
        })),
    [roles],
  )

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle>Role Contribution (3v3)</CardTitle>
          <SectionTooltip>
            Average team win rate when a role is present on the team. Roles near
            50% are balanced; higher means the role contributes more to team
            success in 3v3 battles.
          </SectionTooltip>
        </div>
        <CardDescription>
          Win rate of teams containing each role
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(1 0 0 / 4%)"
              horizontal={false}
            />
            <XAxis
              type="number"
              domain={[40, 60]}
              tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="role"
              tick={{ fontSize: 11, fill: 'oklch(0.65 0.03 290)' }}
              width={70}
            />
            <RechartsTooltip
              contentStyle={TOOLTIP_CONTENT_STYLE}
              itemStyle={TOOLTIP_ITEM_STYLE}
              labelStyle={TOOLTIP_LABEL_STYLE}
              formatter={((value: number) => [`${value}%`, 'Team WR']) as any}
            />
            <ReferenceLine
              x={50}
              stroke="oklch(1 0 0 / 15%)"
              strokeDasharray="4 4"
            />
            <Bar dataKey="winRate" radius={[0, 3, 3, 0]} barSize={20}>
              {data.map((d) => (
                <Cell
                  key={d.role}
                  fill={ROLE_COLOR_VALUES[d.role] ?? 'oklch(0.6 0.15 260)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
