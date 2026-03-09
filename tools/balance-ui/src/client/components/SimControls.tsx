import { Info, Loader2, Play } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { NumericInput } from './ui/numeric-input'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

import type { ConstantsSnapshot, SimType } from '../../shared/types.ts'
import type { SimState } from './results/constants'

export interface MetaSimOptions {
  population: number
  generations: number
  matchesPerTeam: number
  eliteRate: number
  mutationRate: number
}

export interface FieldSimOptions {
  trialsPerPair: number
  teamSampleSize: number
  teamMatchCount: number
}

export interface SharedSimOptions {
  normalizeStats: boolean
  noActives: boolean
  noPassives: boolean
  syntheticMode: boolean
}

export type MetaProgress = {
  generation: number
  total: number
  topFitness: number
  avgFitness: number
}

export type FieldProgress = {
  phase: string
  completed: number
  total: number
}

interface Props {
  simType: SimType
  onSimTypeChange: (type: SimType) => void
  metaOptions: MetaSimOptions
  onMetaOptionsChange: (options: MetaSimOptions) => void
  fieldOptions: FieldSimOptions
  onFieldOptionsChange: (options: FieldSimOptions) => void
  sharedOptions: SharedSimOptions
  onSharedOptionsChange: (options: SharedSimOptions) => void
  simState: SimState
  metaProgress: MetaProgress | null
  fieldProgress: FieldProgress | null
  onRun: () => void
  constants?: ConstantsSnapshot | null
}

export function SimControls({
  simType,
  onSimTypeChange,
  metaOptions,
  onMetaOptionsChange,
  fieldOptions,
  onFieldOptionsChange,
  sharedOptions,
  onSharedOptionsChange,
  simState,
  metaProgress,
  fieldProgress,
  onRun,
  constants,
}: Props) {
  const running = simState === 'running'

  const syntheticCount = constants
    ? Object.keys(constants.roleDistributions).length *
      constants.activeTemplates.filter((t) => t.id !== 'basic_attack').length *
      constants.passiveTemplates.filter((t) => t.id !== 'none').length
    : 0

  return (
    <div className="border-b border-border p-3">
      {/* Sim Type Toggle */}
      <div className="mb-3 flex rounded-md border border-border text-xs">
        <button
          onClick={() => onSimTypeChange('meta')}
          disabled={running}
          className={cn(
            'flex-1 px-3 py-1.5 transition-colors',
            simType === 'meta'
              ? 'bg-primary text-primary-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Meta Sim
        </button>
        <button
          onClick={() => onSimTypeChange('field')}
          disabled={running}
          className={cn(
            'flex-1 px-3 py-1.5 transition-colors',
            simType === 'field'
              ? 'bg-primary text-primary-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          Field Sim
        </button>
      </div>

      <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {simType === 'meta' ? 'Meta Sim Options' : 'Field Sim Options'}
        <Tooltip>
          <TooltipTrigger asChild>
            <Info size={12} className="text-muted-foreground/80" />
          </TooltipTrigger>
          <TooltipContent side="right">
            {simType === 'meta'
              ? 'Genetic algorithm — evolves 3v3 teams to find the metagame. Higher values = more accurate but slower.'
              : 'Exhaustive round-robin — tests every creature/team matchup. Answers "is each creature balanced?"'}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Meta-specific options */}
      {simType === 'meta' && (
        <div className="mb-3 flex flex-col gap-2">
          <OptionRow
            label="Population"
            tooltip="Number of teams per generation. Higher = more diverse meta exploration."
          >
            <NumericInput
              min={10}
              max={1000}
              step={1}
              value={metaOptions.population}
              onChange={(v) =>
                onMetaOptionsChange({ ...metaOptions, population: v })
              }
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
              value={metaOptions.generations}
              onChange={(v) =>
                onMetaOptionsChange({ ...metaOptions, generations: v })
              }
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
              value={metaOptions.matchesPerTeam}
              onChange={(v) =>
                onMetaOptionsChange({ ...metaOptions, matchesPerTeam: v })
              }
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
              value={metaOptions.eliteRate}
              onChange={(v) =>
                onMetaOptionsChange({ ...metaOptions, eliteRate: v })
              }
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
              value={metaOptions.mutationRate}
              onChange={(v) =>
                onMetaOptionsChange({ ...metaOptions, mutationRate: v })
              }
              disabled={running}
              className="w-20 text-center text-xs px-2"
            />
          </OptionRow>
        </div>
      )}

      {/* Field-specific options */}
      {simType === 'field' && (
        <div className="mb-3 flex flex-col gap-2">
          <OptionRow
            label="Trials/Pair"
            tooltip="Battles per creature pair (split evenly across sides). More trials = more accurate win rates."
          >
            <NumericInput
              min={2}
              max={200}
              step={2}
              value={fieldOptions.trialsPerPair}
              onChange={(v) =>
                onFieldOptionsChange({ ...fieldOptions, trialsPerPair: v })
              }
              disabled={running}
              className="w-20 text-center text-xs px-2"
            />
          </OptionRow>
          <OptionRow
            label="Team Sample"
            tooltip="Number of random 3v3 teams to generate for team-level analysis."
          >
            <NumericInput
              min={50}
              max={5000}
              step={50}
              value={fieldOptions.teamSampleSize}
              onChange={(v) =>
                onFieldOptionsChange({ ...fieldOptions, teamSampleSize: v })
              }
              disabled={running}
              className="w-20 text-center text-xs px-2"
            />
          </OptionRow>
          <OptionRow
            label="Matches/Team"
            tooltip="Opponents per team in the team round-robin. More = better synergy measurement."
          >
            <NumericInput
              min={10}
              max={500}
              step={10}
              value={fieldOptions.teamMatchCount}
              onChange={(v) =>
                onFieldOptionsChange({ ...fieldOptions, teamMatchCount: v })
              }
              disabled={running}
              className="w-20 text-center text-xs px-2"
            />
          </OptionRow>
        </div>
      )}

      {/* Isolation Flags (shared) */}
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
            checked={sharedOptions.normalizeStats}
            onChange={(v) =>
              onSharedOptionsChange({ ...sharedOptions, normalizeStats: v })
            }
            disabled={running}
          />
          <CheckboxRow
            label="No Actives"
            tooltip="Replace all active abilities with Bite (baseline damage)."
            checked={sharedOptions.noActives}
            onChange={(v) =>
              onSharedOptionsChange({ ...sharedOptions, noActives: v })
            }
            disabled={running}
          />
          <CheckboxRow
            label="No Passives"
            tooltip="Disable all passive abilities."
            checked={sharedOptions.noPassives}
            onChange={(v) =>
              onSharedOptionsChange({ ...sharedOptions, noPassives: v })
            }
            disabled={running}
          />
          <CheckboxRow
            label="Synthetic Mode"
            tooltip="Ignore seeded creatures. Generate all combinations of role stats x active x passive abilities with baseline stats."
            checked={sharedOptions.syntheticMode}
            onChange={(v) =>
              onSharedOptionsChange({ ...sharedOptions, syntheticMode: v })
            }
            disabled={running}
          />
        </div>
      </div>

      {sharedOptions.syntheticMode &&
        syntheticCount > 0 &&
        simType === 'meta' &&
        metaOptions.population < Math.ceil(syntheticCount / 2) && (
          <div className="mb-2 rounded-md bg-warning/10 px-3 py-1.5 text-[10px] text-warning">
            Synthetic mode generates {syntheticCount} creatures. Population
            should be {Math.ceil(syntheticCount / 2)}+ for adequate coverage.
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
            Run {simType === 'meta' ? 'Meta' : 'Field'} Sim
          </>
        )}
      </Button>

      {/* Meta Progress */}
      {running && simType === 'meta' && metaProgress && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span>
              Gen {metaProgress.generation}/{metaProgress.total}
            </span>
            <span>
              Top {(metaProgress.topFitness * 100).toFixed(1)}% | Avg{' '}
              {(metaProgress.avgFitness * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${(metaProgress.generation / metaProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Field Progress */}
      {running && simType === 'field' && fieldProgress && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-[10px] text-muted-foreground">
            <span className="capitalize">
              {fieldProgress.phase.replace('-', ' ')}
            </span>
            <span>
              {fieldProgress.completed}/{fieldProgress.total}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{
                width: `${fieldProgress.total > 0 ? (fieldProgress.completed / fieldProgress.total) * 100 : 0}%`,
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
