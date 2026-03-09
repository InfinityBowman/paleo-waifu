import { cn } from '../../lib/utils'
import {
  AVG_TURNS_TARGET_MAX,
  AVG_TURNS_TARGET_MIN,
  entries,
} from './constants'

export function TargetBandIndicator({
  roleShares,
}: {
  roleShares: Record<string, number>
}) {
  const roles = entries(roleShares)
  const allInBand = roles.every(([, share]) => share >= 0.15 && share <= 0.35)

  return (
    <div
      className={cn(
        'mt-3 rounded-lg px-3 py-2 text-[11px]',
        allInBand
          ? 'bg-success/10 text-success'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      Target band: 15-35% per role.{' '}
      {allInBand
        ? 'All roles within target!'
        : roles
            .filter(([, s]) => s < 0.15 || s > 0.35)
            .map(([r, s]) => `${r}: ${(s * 100).toFixed(1)}%`)
            .join(', ') + ' out of band'}
    </div>
  )
}

export function TurnsTargetIndicator({ avgTurns }: { avgTurns: number }) {
  const inBand =
    avgTurns >= AVG_TURNS_TARGET_MIN && avgTurns <= AVG_TURNS_TARGET_MAX

  return (
    <div
      className={cn(
        'mt-3 rounded-lg px-3 py-2 text-[11px]',
        inBand
          ? 'bg-success/10 text-success'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      Target: {AVG_TURNS_TARGET_MIN}-{AVG_TURNS_TARGET_MAX} avg turns.{' '}
      {inBand
        ? `${avgTurns.toFixed(1)} turns — within target!`
        : avgTurns < AVG_TURNS_TARGET_MIN
          ? `${avgTurns.toFixed(1)} turns — too short (damage too high or HP too low)`
          : `${avgTurns.toFixed(1)} turns — too long (damage too low or HP too high)`}
    </div>
  )
}

export function DiversityIndicator({ diversity }: { diversity: number }) {
  const healthy = diversity >= 30

  return (
    <div
      className={cn(
        'mt-2 rounded-lg px-3 py-2 text-[11px]',
        healthy ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
      )}
    >
      <span className="font-medium">Diversity: {diversity.toFixed(0)}%</span>
      <span className="ml-1.5 opacity-75">
        — % of unique team compositions in the population.{' '}
        {healthy
          ? 'Healthy variety in team building.'
          : 'Low diversity — meta is converging on a few dominant teams.'}
      </span>
    </div>
  )
}

export function MetaBreadthIndicator({ breadth }: { breadth: number }) {
  const healthy = breadth >= 50

  return (
    <div
      className={cn(
        'mt-2 rounded-lg px-3 py-2 text-[11px]',
        healthy ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
      )}
    >
      <span className="font-medium">Meta Breadth: {breadth.toFixed(0)}%</span>
      <span className="ml-1.5 opacity-75">
        — % of creatures appearing in top teams.{' '}
        {healthy
          ? 'Wide variety of creatures seeing play.'
          : 'Narrow meta — few creatures dominate winning teams.'}
      </span>
    </div>
  )
}
