import { Card, CardContent } from '@/components/ui/card'

export type IconComponent = React.ComponentType<{
  className?: string
  style?: React.CSSProperties
}>

export function StatCard({
  label,
  value,
  subtitle,
  icon: Icon,
}: {
  label: string
  value: string | number
  subtitle?: string
  icon: IconComponent
}) {
  return (
    <Card size="sm" className="group transition-shadow hover:shadow-md">
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="h-4 w-4" />
              {label}
            </div>
            <div className="mt-1 font-display text-2xl font-bold">{value}</div>
            {subtitle && (
              <div className="mt-0.5 text-xs text-muted-foreground">
                {subtitle}
              </div>
            )}
          </div>
          <Icon className="h-10 w-10 text-muted-foreground/10 transition-colors group-hover:text-muted-foreground/20" />
        </div>
      </CardContent>
    </Card>
  )
}
