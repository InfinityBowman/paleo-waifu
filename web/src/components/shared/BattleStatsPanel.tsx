import { Heart, Shield, Swords, Wind, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BattleStatsData {
  role: string
  hp: number
  atk: number
  def: number
  spd: number
  active: { displayName: string; description: string; cooldown: number } | null
  passive: { displayName: string; description: string } | null
}

const ROLE_INFO: Record<
  string,
  { label: string; color: string; description: string }
> = {
  striker: {
    label: 'Striker',
    color: 'text-red-400',
    description: 'High damage dealer',
  },
  tank: {
    label: 'Tank',
    color: 'text-blue-400',
    description: 'Absorbs damage for the team',
  },
  support: {
    label: 'Support',
    color: 'text-green-400',
    description: 'Heals and buffs allies',
  },
  bruiser: {
    label: 'Bruiser',
    color: 'text-orange-400',
    description: 'Balanced offense and defense',
  },
}

const STAT_CONFIG = [
  { key: 'hp', label: 'HP', icon: Heart, color: 'bg-green-500', max: 110 },
  { key: 'atk', label: 'ATK', icon: Swords, color: 'bg-red-500', max: 80 },
  { key: 'def', label: 'DEF', icon: Shield, color: 'bg-blue-500', max: 80 },
  { key: 'spd', label: 'SPD', icon: Wind, color: 'bg-amber-500', max: 70 },
] as const

export function BattleStatsPanel({ stats }: { stats: BattleStatsData }) {
  const role = ROLE_INFO[stats.role] ?? ROLE_INFO.bruiser

  return (
    <div className="mt-4 space-y-3">
      {/* Role */}
      <div className="flex items-center gap-2">
        <Swords className={cn('h-4 w-4', role.color)} />
        <span className={cn('text-sm font-semibold', role.color)}>
          {role.label}
        </span>
        <span className="text-xs text-muted-foreground">
          — {role.description}
        </span>
      </div>

      {/* Stat bars */}
      <div className="space-y-1.5">
        {STAT_CONFIG.map(({ key, label, icon: Icon, color, max }) => {
          const value = stats[key]
          const pct = Math.min(100, (value / max) * 100)
          return (
            <div key={key} className="flex items-center gap-2">
              <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="w-7 text-xs text-muted-foreground">{label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40">
                <div
                  className={cn('h-full rounded-full', color)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-6 text-right text-xs font-medium">
                {value}
              </span>
            </div>
          )
        })}
      </div>

      {/* Abilities */}
      <div className="space-y-2 pt-1">
        {stats.active && (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <Zap className="h-3 w-3 text-amber-400" />
              <span className="text-xs font-semibold">
                {stats.active.displayName}
              </span>
              {stats.active.cooldown > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  CD {stats.active.cooldown}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {stats.active.description}
            </p>
          </div>
        )}
        {stats.passive && (
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
            <div className="flex items-center gap-2">
              <Shield className="h-3 w-3 text-purple-400" />
              <span className="text-xs font-semibold">
                {stats.passive.displayName}
              </span>
              <span className="text-[10px] text-muted-foreground">Passive</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {stats.passive.description}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
