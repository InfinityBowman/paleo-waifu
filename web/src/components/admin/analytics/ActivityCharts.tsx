import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_TICK, CHART_TOOLTIP_STYLE, GRID_STROKE } from './chart-config'
import { Card, CardContent } from '@/components/ui/card'

function TimeSeriesChart({
  data,
  label,
  color,
  gradientId,
}: {
  data: Array<{ date: string; count: number }>
  label: string
  color: string
  gradientId: string
}) {
  return (
    <Card>
      <CardContent className="py-6">
        <div className="mb-4 text-sm font-medium text-muted-foreground">
          {label}
        </div>
        {data.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            No data yet.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis
                dataKey="date"
                tick={AXIS_TICK}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={AXIS_TICK} allowDecimals={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Area
                type="monotone"
                dataKey="count"
                stroke={color}
                fill={`url(#${gradientId})`}
                strokeWidth={2}
                name={label.replace(' per Day', '')}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}

export function ActivityCharts({
  pullsPerDay,
  usersPerDay,
}: {
  pullsPerDay: Array<{ date: string; count: number }>
  usersPerDay: Array<{ date: string; count: number }>
}) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-bold">
        Activity (Last 30 Days)
      </h2>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TimeSeriesChart
          data={pullsPerDay}
          label="Pulls per Day"
          color="#a855f7"
          gradientId="pullGrad"
        />
        <TimeSeriesChart
          data={usersPerDay}
          label="New Users per Day"
          color="#3b82f6"
          gradientId="userGrad"
        />
      </div>
    </section>
  )
}
