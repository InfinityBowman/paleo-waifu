import { Play, Loader2, Info } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip'

type SimState = 'idle' | 'running' | 'done' | 'error'

interface SimOptions {
  population: number
  generations: number
  matchesPerTeam: number
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
}

export function SimControls({
  options,
  onOptionsChange,
  simState,
  progress,
  onRun,
}: Props) {
  const running = simState === 'running'

  function setOpt<K extends keyof SimOptions>(key: K, value: SimOptions[K]) {
    onOptionsChange({ ...options, [key]: value })
  }

  return (
    <div className="border-b border-border p-3">
      <div className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        Sim Options
        <Tooltip>
          <TooltipTrigger asChild>
            <Info size={12} className="cursor-help text-muted-foreground/60" />
          </TooltipTrigger>
          <TooltipContent side="right">
            Configure the genetic algorithm parameters. Higher values = more accurate but slower.
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="mb-3 flex flex-col gap-2">
        <OptionRow
          label="Population"
          tooltip="Number of teams per generation. Higher = more diverse meta exploration."
        >
          <Input
            type="number"
            min={10}
            max={1000}
            step={10}
            value={options.population}
            onChange={(e) => setOpt('population', parseInt(e.target.value, 10) || 100)}
            disabled={running}
            className="w-20 text-center text-xs px-2"
          />
        </OptionRow>
        <OptionRow
          label="Generations"
          tooltip="Number of evolution cycles. More generations let the meta converge further."
        >
          <Input
            type="number"
            min={5}
            max={200}
            step={5}
            value={options.generations}
            onChange={(e) => setOpt('generations', parseInt(e.target.value, 10) || 25)}
            disabled={running}
            className="w-20 text-center text-xs px-2"
          />
        </OptionRow>
        <OptionRow
          label="Matches/Team"
          tooltip="Battles per team per generation. More matches reduce variance in fitness scores."
        >
          <Input
            type="number"
            min={5}
            max={100}
            step={5}
            value={options.matchesPerTeam}
            onChange={(e) => setOpt('matchesPerTeam', parseInt(e.target.value, 10) || 20)}
            disabled={running}
            className="w-20 text-center text-xs px-2"
          />
        </OptionRow>
      </div>

      <Button
        onClick={onRun}
        disabled={running}
        className="w-full"
        size="sm"
      >
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
            <Info size={10} className="cursor-help text-muted-foreground/40" />
          </TooltipTrigger>
          <TooltipContent side="right">{tooltip}</TooltipContent>
        </Tooltip>
      </div>
      {children}
    </div>
  )
}
