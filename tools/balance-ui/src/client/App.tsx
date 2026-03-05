import { useCallback, useEffect, useState } from 'react'
import { fetchCreatures, reloadCreatures, runSim } from './lib/api'
import { CreatureTable } from './components/CreatureTable'
import { GlobalKnobsPanel } from './components/GlobalKnobsPanel'
import { SimControls } from './components/SimControls'
import { ResultsPanel } from './components/ResultsPanel'
import { RefreshCw } from 'lucide-react'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs'
import { TooltipProvider } from './components/ui/tooltip'
import type {
  CreatureRecord,
  ConstantsSnapshot,
  CreatureOverridePatch,
  ConstantsOverride,
  MetaRunResult,
  SimProgressEvent,
} from '../shared/types.ts'

type SimState = 'idle' | 'running' | 'done' | 'error'

export function App() {
  const [creatures, setCreatures] = useState<CreatureRecord[]>([])
  const [constants, setConstants] = useState<ConstantsSnapshot | null>(null)
  const [patches, setPatches] = useState<Map<string, CreatureOverridePatch>>(
    new Map(),
  )
  const [constantsOverride, setConstantsOverride] = useState<ConstantsOverride>(
    {},
  )
  const [tab, setTab] = useState('creatures')
  const [simState, setSimState] = useState<SimState>('idle')
  const [simProgress, setSimProgress] = useState<{
    generation: number
    total: number
    topFitness: number
    avgFitness: number
  } | null>(null)
  const [simResult, setSimResult] = useState<MetaRunResult | null>(null)
  const [simError, setSimError] = useState<string | null>(null)
  const [simOptions, setSimOptions] = useState({
    population: 100,
    generations: 25,
    matchesPerTeam: 20,
  })

  const load = useCallback(async () => {
    const data = await fetchCreatures()
    setCreatures(data.creatures)
    setConstants(data.constants)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleReload() {
    const data = await reloadCreatures()
    setCreatures(data.creatures)
    setConstants(data.constants)
    setPatches(new Map())
  }

  function handlePatch(patch: CreatureOverridePatch) {
    setPatches((prev) => {
      const next = new Map(prev)
      const existing = next.get(patch.id) ?? { id: patch.id }
      next.set(patch.id, { ...existing, ...patch })
      return next
    })
  }

  async function handleRunSim() {
    setSimState('running')
    setSimProgress(null)
    setSimResult(null)
    setSimError(null)

    try {
      await runSim(
        {
          creaturePatches: [...patches.values()],
          constants: constantsOverride,
          options: simOptions,
        },
        (event: SimProgressEvent) => {
          if (event.type === 'generation') {
            setSimProgress({
              generation: event.generation,
              total: event.total,
              topFitness: event.topFitness,
              avgFitness: event.avgFitness,
            })
          } else if (event.type === 'done') {
            setSimResult(event.result)
            setSimState('done')
            setTab('results')
          } else if (event.type === 'error') {
            setSimError(event.message)
            setSimState('error')
          }
        },
      )
    } catch (err) {
      setSimError(err instanceof Error ? err.message : String(err))
      setSimState('error')
    }
  }

  function handleResetPatches() {
    setPatches(new Map())
    setConstantsOverride({})
  }

  const patchCount =
    [...patches.values()].filter(
      (p) => Object.keys(p).length > 1,
    ).length + Object.keys(constantsOverride).length

  if (!constants) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex h-screen flex-col">
        {/* Header */}
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-semibold text-primary">
              Balance Tuning
            </h1>
            <span className="text-xs text-muted-foreground">
              {creatures.length} creatures
            </span>
            {patchCount > 0 && (
              <Badge variant="default" className="text-[10px]">
                {patchCount} override{patchCount !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {patchCount > 0 && (
              <Button variant="ghost" size="xs" onClick={handleResetPatches}>
                Reset All
              </Button>
            )}
            <Button variant="outline" size="xs" onClick={handleReload}>
              <RefreshCw size={12} />
              Reload DB
            </Button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1">
          {/* Left sidebar */}
          <aside className="flex w-80 flex-shrink-0 flex-col overflow-y-auto border-r border-border">
            <SimControls
              options={simOptions}
              onOptionsChange={setSimOptions}
              simState={simState}
              progress={simProgress}
              onRun={handleRunSim}
            />
            <GlobalKnobsPanel
              constants={constants}
              overrides={constantsOverride}
              onChange={setConstantsOverride}
            />
          </aside>

          {/* Main content */}
          <Tabs
            value={tab}
            onValueChange={setTab}
            className="min-w-0 flex-1"
          >
            <TabsList className="w-full">
              <TabsTrigger value="creatures">Creatures</TabsTrigger>
              <TabsTrigger value="results" className="gap-1.5">
                Results
                {simResult && (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="creatures" className="min-h-0 overflow-y-auto">
              <CreatureTable
                creatures={creatures}
                patches={patches}
                constants={constants}
                onPatch={handlePatch}
              />
            </TabsContent>

            <TabsContent value="results" className="min-h-0 overflow-y-auto">
              <ResultsPanel
                result={simResult}
                error={simError}
                simState={simState}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  )
}
