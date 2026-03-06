import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts'
import { ROLE_ORDER, TOOLTIP_CONTENT_STYLE, TOOLTIP_ITEM_STYLE, TOOLTIP_LABEL_STYLE } from '../constants'

const STAT_COLORS = {
  'Damage Dealt': 'oklch(0.65 0.2 25)',    // red-orange
  'Damage Taken': 'oklch(0.55 0.12 290)',   // muted purple
  'Healing Done': 'oklch(0.65 0.18 145)',   // green
  'Shields Applied': 'oklch(0.7 0.15 210)', // cyan-blue
  'Debuffs Landed': 'oklch(0.65 0.17 330)', // magenta
}

export function RoleContributionsChart({
  roleContributions,
}: {
  roleContributions: Record<
    string,
    {
      avgDamageDealt: number
      avgDamageTaken: number
      avgHealingDone: number
      avgShieldsApplied: number
      avgDebuffsLanded: number
    }
  >
}) {
  const data = useMemo(() => {
    return Object.entries(roleContributions)
      .sort(
        ([a], [b]) =>
          (ROLE_ORDER.indexOf(a) === -1 ? 99 : ROLE_ORDER.indexOf(a)) - (ROLE_ORDER.indexOf(b) === -1 ? 99 : ROLE_ORDER.indexOf(b)),
      )
      .map(([role, stats]) => ({
        role: role.charAt(0).toUpperCase() + role.slice(1),
        'Damage Dealt': Math.round(stats.avgDamageDealt),
        'Damage Taken': Math.round(stats.avgDamageTaken),
        'Healing Done': Math.round(stats.avgHealingDone),
        'Shields Applied': Math.round(stats.avgShieldsApplied),
        'Debuffs Landed': Math.round(stats.avgDebuffsLanded * 10) / 10,
      }))
  }, [roleContributions])

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 12, bottom: 5, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 4%)" />
        <XAxis
          dataKey="role"
          tick={{ fontSize: 11, fill: 'oklch(0.65 0.03 290)' }}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'oklch(0.65 0.03 290)' }}
          width={50}
        />
        <RechartsTooltip
          contentStyle={TOOLTIP_CONTENT_STYLE}
          itemStyle={TOOLTIP_ITEM_STYLE}
          labelStyle={TOOLTIP_LABEL_STYLE}
        />
        <Legend
          verticalAlign="top"
          height={28}
          wrapperStyle={{ fontSize: 10 }}
        />
        <Bar
          dataKey="Damage Dealt"
          fill={STAT_COLORS['Damage Dealt']}
          radius={[3, 3, 0, 0]}
          barSize={14}
        />
        <Bar
          dataKey="Damage Taken"
          fill={STAT_COLORS['Damage Taken']}
          radius={[3, 3, 0, 0]}
          barSize={14}
        />
        <Bar
          dataKey="Healing Done"
          fill={STAT_COLORS['Healing Done']}
          radius={[3, 3, 0, 0]}
          barSize={14}
        />
        <Bar
          dataKey="Shields Applied"
          fill={STAT_COLORS['Shields Applied']}
          radius={[3, 3, 0, 0]}
          barSize={14}
        />
        <Bar
          dataKey="Debuffs Landed"
          fill={STAT_COLORS['Debuffs Landed']}
          radius={[3, 3, 0, 0]}
          barSize={14}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
