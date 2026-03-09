import { cn } from '../../lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import type { AbilityTemplate, Effect } from '@paleo-waifu/shared/battle/types'

function formatTarget(target: string): string {
  switch (target) {
    case 'self':
      return 'self'
    case 'single_enemy':
      return 'single target'
    case 'all_enemies':
      return 'AOE'
    case 'lowest_hp_ally':
      return 'lowest HP ally'
    case 'all_allies':
      return 'all allies'
    default:
      return target
  }
}

function formatEffect(e: Effect): string {
  switch (e.type) {
    case 'damage':
      return `${e.multiplier}x ${e.scaling} dmg`
    case 'heal':
      return `heal ${e.percent}%`
    case 'dot':
      return `${e.dotKind} ${e.percent}% ${e.duration}t`
    case 'buff':
      return `+${e.percent}% ${e.stat} ${e.duration}t`
    case 'debuff':
      return `-${e.percent}% ${e.stat} ${e.duration}t`
    case 'shield':
      return `shield ${e.percent}% ${e.duration}t`
    case 'stun':
      return `stun ${e.duration}t`
    case 'taunt':
      return `taunt ${e.duration}t`
    case 'lifesteal':
      return `lifesteal ${e.percent}%`
    case 'reflect':
      return `reflect ${e.percent}% ${e.duration}t`
    case 'damage_reduction':
      return `dmg red ${e.percent}%`
    case 'crit_reduction':
      return `crit red ${e.percent}%`
    case 'flat_reduction':
      return `flat red ${e.scalingPercent}% def`
    case 'dodge':
      return `dodge ${e.basePercent}%`
  }
}

function formatTrigger(template: AbilityTemplate): string {
  const t = template.trigger
  switch (t.type) {
    case 'onUse':
      return `Active · cd: ${t.cooldown}t`
    case 'onBasicAttack':
      return 'On basic attack'
    case 'onHit':
      return 'On hit'
    case 'onKill':
      return 'On kill'
    case 'onEnemyKO':
      return 'On enemy KO'
    case 'onAllyKO':
      return 'On ally KO'
    case 'onTurnStart':
      return 'On turn start'
    case 'onTurnEnd':
      return 'On turn end'
    case 'onBattleStart':
      return 'On battle start'
    case 'always':
      return 'Always active'
    default:
      return (t as { type: string }).type
  }
}

export function AbilityCell({
  template,
  displayName,
}: {
  template?: AbilityTemplate
  displayName: string
}) {
  if (!template) {
    return <span className="text-muted-foreground">{displayName}</span>
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-left text-muted-foreground hover:text-foreground transition-colors"
        >
          {displayName}
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" className="w-64 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{template.name}</span>
          <div className="flex gap-0.5">
            {template.roleAffinity.map((role) => (
              <span
                key={role}
                className={cn('h-1.5 w-1.5 rounded-full', `bg-role-${role}`)}
                title={role}
              />
            ))}
          </div>
        </div>

        <div className="mt-1 text-[10px] text-muted-foreground">
          {formatTrigger(template)} · {formatTarget(template.target)}
        </div>

        <p className="mt-1.5 text-[10px] text-muted-foreground/80">
          {template.description}
        </p>

        <div className="mt-2 flex flex-col gap-1 border-t border-border/50 pt-2">
          {template.effects.map((effect, i) => (
            <div key={i} className="flex items-start gap-2 text-[10px]">
              <span className="shrink-0 font-medium text-muted-foreground uppercase">
                {effect.type}
                {'stat' in effect && ` (${(effect as { stat: string }).stat})`}
                {'dotKind' in effect &&
                  ` (${(effect as { dotKind: string }).dotKind})`}
              </span>
              <span className="font-mono text-foreground">
                {formatEffect(effect)}
              </span>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
