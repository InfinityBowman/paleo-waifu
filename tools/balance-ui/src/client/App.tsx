import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { fetchCreatures, reloadCreatures, runSim } from './lib/api'
import { useRunHistory } from './hooks/useRunHistory'
import { CreatureTable } from './components/CreatureTable'
import { GlobalKnobsPanel } from './components/GlobalKnobsPanel'
import { SimControls } from './components/SimControls'
import { ResultsPanel } from './components/ResultsPanel'
import { RunHistoryPanel } from './components/RunHistoryPanel'
import { ComparisonPanel } from './components/ComparisonPanel'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { TooltipProvider } from './components/ui/tooltip'
import type {
  ConstantsOverride,
  ConstantsSnapshot,
  CreatureOverridePatch,
  CreatureRecord,
  MetaRunResult,
  SimProgressEvent,
} from '../shared/types.ts'

type SimState = 'idle' | 'running' | 'done' | 'error'

export function App() {
  const [creatures, setCreatures] = useState<Array<CreatureRecord>>([])
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
    eliteRate: 0.1,
    mutationRate: 0.8,
    normalizeStats: false,
    noActives: false,
    noPassives: false,
  })

  // Run history (IndexedDB)
  const history = useRunHistory()
  const [selectedRunIds, setSelectedRunIds] = useState<Array<string>>([])

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

    const config = {
      creaturePatches: [...patches.values()],
      constants: constantsOverride,
      options: simOptions,
    }

    try {
      await runSim(
        config,
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
            // Auto-save to IndexedDB
            history.saveRun(config, event.result)
          } else {
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

  function handleSelectToggle(id: string) {
    setSelectedRunIds((prev) =>
      prev.includes(id)
        ? prev.filter((r) => r !== id)
        : prev.length < 4
          ? [...prev, id]
          : prev,
    )
  }

  async function handleViewRun(id: string) {
    const run = await history.getRun(id)
    if (!run) return
    setSimResult(run.result)
    setSimState('done')
    setSimError(null)
    setTab('results')
  }

  function handleCompare() {
    if (selectedRunIds.length >= 2) {
      setTab('compare')
    }
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
          <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-r border-border">
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
              <TabsTrigger value="history" className="gap-1.5">
                History
                {history.runs.length > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {history.runs.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="compare"
                disabled={selectedRunIds.length < 2}
                className="gap-1.5"
              >
                Compare
                {selectedRunIds.length >= 2 && (
                  <span className="text-[10px] text-muted-foreground">
                    {selectedRunIds.length}
                  </span>
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
                population={simOptions.population}
              />
            </TabsContent>

            <TabsContent value="history" className="min-h-0 overflow-y-auto">
              <RunHistoryPanel
                runs={history.runs}
                selectedIds={selectedRunIds}
                onSelectToggle={handleSelectToggle}
                onDelete={history.deleteRun}
                onRename={history.updateLabel}
                onToggleStar={history.toggleStar}
                onViewRun={handleViewRun}
                onCompare={handleCompare}
                onClearAll={history.clearAll}
              />
            </TabsContent>

            <TabsContent value="compare" className="min-h-0 overflow-y-auto">
              <ComparisonPanel
                runIds={selectedRunIds}
                getRun={history.getRun}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  )
}
