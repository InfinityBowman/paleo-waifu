import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from './lib/utils'
import { fetchCreatures, reloadCreatures, runFieldSim, runSim } from './lib/api'
import { useRunHistory } from './hooks/useRunHistory'
import { CreatureTable } from './components/CreatureTable'
import { GlobalKnobsPanel } from './components/GlobalKnobsPanel'
import { SimControls } from './components/SimControls'
import { ResultsPanel } from './components/ResultsPanel'
import { FieldResultsPanel } from './components/FieldResultsPanel'
import { RunHistoryPanel } from './components/RunHistoryPanel'
import { ComparisonPanel } from './components/ComparisonPanel'
import { AbilitiesPanel } from './components/AbilitiesPanel'
import { BattlePanel } from './components/BattlePanel'
import { Button } from './components/ui/button'
import { Badge } from './components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import { TooltipProvider } from './components/ui/tooltip'
import type {
  ConstantsOverride,
  ConstantsSnapshot,
  CreatureOverridePatch,
  CreatureRecord,
  FieldRunResult,
  FieldSimProgressEvent,
  FieldSimRequest,
  MetaRunResult,
  RunSummary,
  SimProgressEvent,
  SimRequest,
  SimType,
} from '../shared/types.ts'
import type {
  FieldProgress,
  FieldSimOptions,
  MetaProgress,
  MetaSimOptions,
  SharedSimOptions,
} from './components/SimControls'
import type { SimState } from './components/results/constants'

export function App() {
  const [creatures, setCreatures] = useState<Array<CreatureRecord>>([])
  const [constants, setConstants] = useState<ConstantsSnapshot | null>(null)
  const [patches, setPatches] = useState<Map<string, CreatureOverridePatch>>(
    new Map(),
  )
  const [constantsOverride, setConstantsOverride] = useState<ConstantsOverride>(
    {},
  )
  const [tab, setTab] = useState(() => {
    const hash = window.location.hash.slice(1)
    const valid = ['creatures', 'abilities', 'results', 'history', 'compare', 'battle']
    return valid.includes(hash) ? hash : 'creatures'
  })

  useEffect(() => {
    window.location.hash = tab
  }, [tab])

  // ─── Sim Type ───────────────────────────────────────────────
  const [simType, setSimType] = useState<SimType>('meta')

  // ─── Sim State (shared — only one sim runs at a time) ──────
  const [simState, setSimState] = useState<SimState>('idle')
  const [simError, setSimError] = useState<string | null>(null)

  // ─── Meta Sim State ─────────────────────────────────────────
  const [metaProgress, setMetaProgress] = useState<MetaProgress | null>(null)
  const [metaResult, setMetaResult] = useState<MetaRunResult | null>(null)
  const [metaConfig, setMetaConfig] = useState<{
    options: SimRequest['options']
    constants: ConstantsOverride
    creaturePatches: Array<CreatureOverridePatch>
  } | null>(null)
  const [metaOptions, setMetaOptions] = useState<MetaSimOptions>({
    population: 200,
    generations: 25,
    matchesPerTeam: 20,
    eliteRate: 0.1,
    mutationRate: 0.8,
  })

  // ─── Field Sim State ────────────────────────────────────────
  const [fieldProgress, setFieldProgress] = useState<FieldProgress | null>(null)
  const [fieldResult, setFieldResult] = useState<FieldRunResult | null>(null)
  const [fieldConfig, setFieldConfig] = useState<{
    options: FieldSimRequest['options']
    constants: ConstantsOverride
    creaturePatches: Array<CreatureOverridePatch>
  } | null>(null)
  const [fieldOptions, setFieldOptions] = useState<FieldSimOptions>({
    trialsPerPair: 20,
    teamSampleSize: 500,
    teamMatchCount: 50,
  })

  // ─── Shared Isolation Options ───────────────────────────────
  const [sharedOptions, setSharedOptions] = useState<SharedSimOptions>({
    normalizeStats: true,
    noActives: false,
    noPassives: false,
    syntheticMode: false,
  })

  // Track which sim type produced the current "results" tab view
  const [activeResultType, setActiveResultType] = useState<SimType>('meta')

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

  // Auto-restore latest run of each type on mount
  const hasAutoRestored = useRef(false)
  useEffect(() => {
    if (history.loading || hasAutoRestored.current) return
    hasAutoRestored.current = true

    Promise.all([
      history.getLatestRunByType('meta'),
      history.getLatestRunByType('field'),
    ]).then(([metaRun, fieldRun]) => {
      if (metaRun && metaRun.simType === 'meta') {
        setMetaResult(metaRun.result)
        setMetaConfig(metaRun.config)
      }
      if (fieldRun && fieldRun.simType === 'field') {
        setFieldResult(fieldRun.result)
        setFieldConfig(fieldRun.config)
      }

      // Show the most recent one
      const latest =
        metaRun && fieldRun
          ? metaRun.createdAt > fieldRun.createdAt ? metaRun : fieldRun
          : metaRun ?? fieldRun
      if (latest) {
        setActiveResultType(latest.simType)
        setSimState('done')
      }
    })
  }, [history.loading])

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
      const merged = { ...existing, ...patch }
      for (const key of Object.keys(merged) as Array<keyof CreatureOverridePatch>) {
        if (merged[key] === undefined) delete merged[key]
      }
      if (Object.keys(merged).length <= 1) {
        next.delete(patch.id)
      } else {
        next.set(patch.id, merged)
      }
      return next
    })
  }

  async function handleRunSim() {
    if (simType === 'meta') {
      await handleRunMetaSim()
    } else {
      await handleRunFieldSim()
    }
  }

  async function handleRunMetaSim() {
    setSimState('running')
    setMetaProgress(null)
    setMetaResult(null)
    setSimError(null)

    const config = {
      creaturePatches: [...patches.values()],
      constants: constantsOverride,
      options: { ...metaOptions, ...sharedOptions },
    }

    try {
      await runSim(config, (event: SimProgressEvent) => {
        if (event.type === 'generation') {
          setMetaProgress({
            generation: event.generation,
            total: event.total,
            topFitness: event.topFitness,
            avgFitness: event.avgFitness,
          })
        } else if (event.type === 'done') {
          setMetaResult(event.result)
          setMetaConfig(config)
          setActiveResultType('meta')
          setSimState('done')
          setTab('results')
          history.saveMetaRun(config, event.result)
        } else {
          setSimError(event.message)
          setSimState('error')
        }
      })
    } catch (err) {
      setSimError(err instanceof Error ? err.message : String(err))
      setSimState('error')
    }
  }

  async function handleRunFieldSim() {
    setSimState('running')
    setFieldProgress(null)
    setFieldResult(null)
    setSimError(null)

    const config = {
      creaturePatches: [...patches.values()],
      constants: constantsOverride,
      options: { ...fieldOptions, ...sharedOptions },
    }

    try {
      await runFieldSim(config, (event: FieldSimProgressEvent) => {
        if (event.type === 'progress') {
          setFieldProgress({
            phase: event.phase,
            completed: event.completed,
            total: event.total,
          })
        } else if (event.type === 'done') {
          setFieldResult(event.result)
          setFieldConfig(config)
          setActiveResultType('field')
          setSimState('done')
          setTab('results')
          history.saveFieldRun(config, event.result)
        } else {
          setSimError(event.message)
          setSimState('error')
        }
      })
    } catch (err) {
      setSimError(err instanceof Error ? err.message : String(err))
      setSimState('error')
    }
  }

  function handleResetPatches() {
    setPatches(new Map())
    setConstantsOverride({})
  }

  function handleApplyConfig(cfg: {
    options: SimRequest['options']
    constants: ConstantsOverride
    creaturePatches: Array<CreatureOverridePatch>
  }) {
    setMetaOptions({
      population: cfg.options.population,
      generations: cfg.options.generations,
      matchesPerTeam: cfg.options.matchesPerTeam,
      eliteRate: cfg.options.eliteRate,
      mutationRate: cfg.options.mutationRate,
    })
    setSharedOptions({
      normalizeStats: cfg.options.normalizeStats,
      noActives: cfg.options.noActives,
      noPassives: cfg.options.noPassives,
      syntheticMode: cfg.options.syntheticMode,
    })
    setConstantsOverride(cfg.constants)
    const next = new Map<string, CreatureOverridePatch>()
    for (const p of cfg.creaturePatches) {
      next.set(p.id, p)
    }
    setPatches(next)
    setSimType('meta')
  }

  function handleApplyFieldConfig(cfg: {
    options: FieldSimRequest['options']
    constants: ConstantsOverride
    creaturePatches: Array<CreatureOverridePatch>
  }) {
    setFieldOptions({
      trialsPerPair: cfg.options.trialsPerPair,
      teamSampleSize: cfg.options.teamSampleSize,
      teamMatchCount: cfg.options.teamMatchCount,
    })
    setSharedOptions({
      normalizeStats: cfg.options.normalizeStats,
      noActives: cfg.options.noActives,
      noPassives: cfg.options.noPassives,
      syntheticMode: cfg.options.syntheticMode,
    })
    setConstantsOverride(cfg.constants)
    const next = new Map<string, CreatureOverridePatch>()
    for (const p of cfg.creaturePatches) {
      next.set(p.id, p)
    }
    setPatches(next)
    setSimType('field')
  }

  function handleApplyRunConfig(run: RunSummary) {
    if (run.simType === 'meta') {
      handleApplyConfig(run.config)
    } else {
      handleApplyFieldConfig(run.config)
    }
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
    if (run.simType === 'field') {
      setFieldResult(run.result)
      setFieldConfig(run.config)
      setActiveResultType('field')
    } else {
      setMetaResult(run.result)
      setMetaConfig(run.config)
      setActiveResultType('meta')
    }
    setSimState('done')
    setSimError(null)
    setTab('results')
  }

  function handleCompare() {
    if (selectedRunIds.length >= 2) {
      setTab('compare')
    }
  }

  const constantsOverrideCount =
    Object.values(constantsOverride.roleModifiers ?? {}).filter(
      (m) => Object.keys(m).length > 0,
    ).length +
    Object.keys(constantsOverride.rarityModifiers ?? {}).length +
    (constantsOverride.combatDamageScale !== undefined ? 1 : 0) +
    (constantsOverride.defScalingConstant !== undefined ? 1 : 0) +
    (constantsOverride.basicAttackMultiplier !== undefined ? 1 : 0) +
    Object.keys(constantsOverride.abilityOverrides ?? {}).length

  const patchCount =
    [...patches.values()].filter((p) => Object.keys(p).length > 1).length +
    constantsOverrideCount

  const hasResult = activeResultType === 'meta' ? !!metaResult : !!fieldResult

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
              simType={simType}
              onSimTypeChange={setSimType}
              metaOptions={metaOptions}
              onMetaOptionsChange={setMetaOptions}
              fieldOptions={fieldOptions}
              onFieldOptionsChange={setFieldOptions}
              sharedOptions={sharedOptions}
              onSharedOptionsChange={setSharedOptions}
              simState={simState}
              metaProgress={metaProgress}
              fieldProgress={fieldProgress}
              onRun={handleRunSim}
              constants={constants}
            />
            <GlobalKnobsPanel
              constants={constants}
              creatures={creatures}
              overrides={constantsOverride}
              onChange={setConstantsOverride}
              normalizeStats={sharedOptions.normalizeStats}
            />
          </aside>

          {/* Main content */}
          <Tabs value={tab} onValueChange={setTab} className="min-w-0 flex-1">
            <TabsList className="w-full">
              <TabsTrigger value="creatures">Creatures</TabsTrigger>
              <TabsTrigger value="abilities" className="gap-1.5">
                Abilities
                {Object.keys(constantsOverride.abilityOverrides ?? {}).length >
                  0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {
                      Object.keys(constantsOverride.abilityOverrides ?? {})
                        .length
                    }
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="results" className="gap-1.5">
                Results
                {hasResult && (
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
              <TabsTrigger value="battle">Battle</TabsTrigger>
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

            {/* Meta / Field result toggle — outside scroll container */}
            {tab === 'results' && (metaResult || fieldResult) && (
              <div className="flex items-center gap-1 border-b border-border px-4 py-2">
                <div className="flex rounded-md border border-border text-xs">
                  <button
                    onClick={() => setActiveResultType('meta')}
                    className={cn(
                      'px-3 py-1 transition-colors',
                      activeResultType === 'meta'
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground',
                      !metaResult && 'opacity-40 pointer-events-none',
                    )}
                  >
                    Meta Sim
                  </button>
                  <button
                    onClick={() => setActiveResultType('field')}
                    className={cn(
                      'px-3 py-1 transition-colors',
                      activeResultType === 'field'
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground',
                      !fieldResult && 'opacity-40 pointer-events-none',
                    )}
                  >
                    Field Sim
                  </button>
                </div>
              </div>
            )}

            <TabsContent value="creatures" className="min-h-0 overflow-y-auto">
              <CreatureTable
                creatures={creatures}
                patches={patches}
                constants={constants}
                onPatch={handlePatch}
              />
            </TabsContent>

            <TabsContent value="abilities" className="min-h-0 overflow-y-auto">
              <AbilitiesPanel
                constants={constants}
                overrides={constantsOverride}
                onChange={setConstantsOverride}
              />
            </TabsContent>

            <TabsContent value="results" className="min-h-0 overflow-y-auto">
              {activeResultType === 'field' ? (
                <FieldResultsPanel
                  result={fieldResult}
                  error={simError}
                  simState={simState}
                  metaResult={metaResult}
                  config={fieldConfig}
                  constants={constants}
                  creatures={creatures}
                  onApplyConfig={handleApplyFieldConfig}
                />
              ) : (
                <ResultsPanel
                  result={metaResult}
                  error={simError}
                  simState={simState}
                  population={metaOptions.population}
                  config={metaConfig}
                  constants={constants}
                  creatures={creatures}
                  onApplyConfig={handleApplyConfig}
                />
              )}
            </TabsContent>

            <TabsContent value="history" className="min-h-0 overflow-y-auto">
              <RunHistoryPanel
                runs={history.runs}
                selectedIds={selectedRunIds}
                constants={constants}
                onSelectToggle={handleSelectToggle}
                onDelete={history.deleteRun}
                onRename={history.updateLabel}
                onToggleStar={history.toggleStar}
                onViewRun={handleViewRun}
                onApplyConfig={handleApplyRunConfig}
                onCompare={handleCompare}
                onClearAll={history.clearAll}
              />
            </TabsContent>

            <TabsContent value="battle" className="min-h-0 overflow-y-auto">
              <BattlePanel
                creatures={creatures}
                patches={patches}
                constantsOverride={constantsOverride}
                sharedOptions={sharedOptions}
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
