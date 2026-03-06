import { Info, Loader2, Play } from 'lucide-react'
import { Button } from './ui/button'
import { NumericInput } from './ui/numeric-input'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

import type { ConstantsSnapshot } from '../../shared/types.ts'

type SimState = 'idle' | 'running' | 'done' | 'error'

interface SimOptions {
  population: number
  generations: number
  matchesPerTeam: number
  eliteRate: number
  mutationRate: number
  normalizeStats: boolean
  noActives: boolean
  noPassives: boolean
  syntheticMode: boolean
}

interface Props {
  options: SimOptions
  onOptionsChange: (options: SimOptions) => void
  simState: SimState
  progress: {
    generation: number
    total: number
    topFitness: number
    avgFitness: number
  } | null
  onRun: () => void
  constants?: ConstantsSnapshot | null
}

export function SimControls({
  options,
  onOptionsChange,
  simState,
  progress,
  onRun,
  constants,
}: Props) {
  const running = simState === 'running'

  const syntheticCount = constants
    ? Object.keys(constants.roleDistributions).length *
      constants.activeTemplates.filter((t) => t.id !== 'basic_attack').length *
      constants.passiveTemplates.filter((t) => t.id !== 'none').length
    : 0

  function setOpt<TKey extends keyof SimOptions>(
    key: TKey,
    value: SimOptions[TKey],
  ) {
    onOptionsChange({ ...options, [key]: value })
  }

  return (
    <div className="border-b border-border p-3">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        Sim Options
        <Tooltip>
          <TooltipTrigger asChild>
            <Info size={12} className="text-muted-foreground/80" />
          </TooltipTrigger>
          <TooltipContent side="right">
            Configure the genetic algorithm parameters. Higher values = more
            accurate but slower.
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="mb-3 flex flex-col gap-2">
        <OptionRow
          label="Population"
          tooltip="Number of teams per generation. Higher = more diverse meta exploration."
        >
          <NumericInput
            min={10}
            max={1000}
            step={1}
            value={options.population}
            onChange={(v) => setOpt('population', v)}
            disabled={running}
            className="w-20 text-center text-xs px-2"
          />
        </OptionRow>
        <OptionRow
          label="Generations"
          tooltip="Number of evolution cycles. More generations let the meta converge further."
        >
          <NumericInput
            min={5}
            max={200}
            step={1}
            value={options.generations}
            onChange={(v) => setOpt('generations', v)}
            disabled={running}
            className="w-20 text-center text-xs px-2"
          />
        </OptionRow>
        <OptionRow
          label="Matches/Team"
          tooltip="Battles per team per generation. More matches reduce variance in fitness scores."
        >
          <NumericInput
            min={5}
            max={100}
            step={1}
            value={options.matchesPerTeam}
            onChange={(v) => setOpt('matchesPerTeam', v)}
            disabled={running}
            className="w-20 text-center text-xs px-2"
          />
        </OptionRow>
        <OptionRow
          label="Elite Rate"
          tooltip="Fraction of top teams that pass unchanged to the next generation. Higher = faster convergence."
        >
          <NumericInput
            float
            min={0.01}
            max={0.5}
            step={0.01}
            value={options.eliteRate}
            onChange={(v) => setOpt('eliteRate', v)}
            disabled={running}
            className="w-20 text-center text-xs px-2"
          />
        </OptionRow>
        <OptionRow
          label="Mutation Rate"
          tooltip="Probability offspring are mutated vs crossed over. Higher = more exploration, lower = more exploitation."
        >
          <NumericInput
            float
            min={0.1}
            max={1.0}
            step={0.1}
            value={options.mutationRate}
            onChange={(v) => setOpt('mutationRate', v)}
            disabled={running}
            className="w-20 text-center text-xs px-2"
          />
        </OptionRow>
      </div>

      {/* Isolation Flags */}
      <div className="mb-3 border-t border-border/50 pt-3">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          Isolation Mode
          <Tooltip>
            <TooltipTrigger asChild>
              <Info size={12} className="text-muted-foreground/80" />
            </TooltipTrigger>
            <TooltipContent side="right">
              Strip away abilities or rarity advantage to isolate specific
              balance axes.
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex flex-col gap-1.5">
          <CheckboxRow
            label="Normalize Stats"
            tooltip="Scale all creatures to 170 total stats, removing rarity advantage."
            checked={options.normalizeStats}
            onChange={(v) => setOpt('normalizeStats', v)}
            disabled={running}
          />
          <CheckboxRow
            label="No Actives"
            tooltip="Replace all active abilities with Bite (baseline damage)."
            checked={options.noActives}
            onChange={(v) => setOpt('noActives', v)}
            disabled={running}
          />
          <CheckboxRow
            label="No Passives"
            tooltip="Disable all passive abilities."
            checked={options.noPassives}
            onChange={(v) => setOpt('noPassives', v)}
            disabled={running}
          />
          <CheckboxRow
            label="Synthetic Mode"
            tooltip="Ignore seeded creatures. Generate all combinations of role stats × active × passive abilities with baseline stats."
            checked={options.syntheticMode}
            onChange={(v) => setOpt('syntheticMode', v)}
            disabled={running}
          />
        </div>
      </div>

      {options.syntheticMode && syntheticCount > 0 && options.population < Math.ceil(syntheticCount / 2) && (
        <div className="mb-2 rounded-md bg-warning/10 px-3 py-1.5 text-[10px] text-warning">
          Synthetic mode generates {syntheticCount} creatures. Population should be {Math.ceil(syntheticCount / 2)}+ for adequate coverage.
        </div>
      )}

      <Button onClick={onRun} disabled={running} className="w-full" size="sm">
        {running ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            Running...
          </>
        ) : (
          <>
            <Play size={14} />
            Run Sim
          </>
        )}
      </Button>

      {/* Progress */}
      {running && progress && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span>
              Gen {progress.generation}/{progress.total}
            </span>
            <span>
              Top {(progress.topFitness * 100).toFixed(1)}% | Avg{' '}
              {(progress.avgFitness * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${(progress.generation / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function OptionRow({
  label,
  tooltip,
  children,
}: {
  label: string
  tooltip: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info size={10} className="text-muted-foreground/70" />
          </TooltipTrigger>
          <TooltipContent side="right">{tooltip}</TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  )
}

function CheckboxRow({
  label,
  tooltip,
  checked,
  onChange,
  disabled,
}: {
  label: string
  tooltip: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <label className="text-xs text-muted-foreground">{label}</label>
        <Tooltip>
          <TooltipTrigger asChild>
            <Info size={10} className="text-muted-foreground/70" />
          </TooltipTrigger>
          <TooltipContent side="right">{tooltip}</TooltipContent>
        </Tooltip>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="accent-primary"
      />
    </div>
  )
}
