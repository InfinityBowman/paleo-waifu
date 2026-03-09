import { useCallback, useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import { getDb } from '../lib/db'
import type {
  ConstantsOverride,
  CreatureOverridePatch,
  FieldRunResult,
  FieldSimRequest,
  MetaRunResult,
  RunSummary,
  SavedRun,
  SimRequest,
} from '../../shared/types.ts'

const MAX_RUNS = 50

function computePatchCount(config: {
  constants: ConstantsOverride
  creaturePatches: Array<CreatureOverridePatch>
}): number {
  const constantsCount =
    Object.values(config.constants.roleModifiers ?? {}).filter(
      (m) => Object.keys(m).length > 0,
    ).length +
    Object.keys(config.constants.rarityModifiers ?? {}).length +
    (config.constants.combatDamageScale !== undefined ? 1 : 0) +
    (config.constants.defScalingConstant !== undefined ? 1 : 0) +
    (config.constants.basicAttackMultiplier !== undefined ? 1 : 0) +
    Object.keys(config.constants.abilityOverrides ?? {}).length
  return (
    config.creaturePatches.filter((p) => Object.keys(p).length > 1).length +
    constantsCount
  )
}

function toSummary(run: SavedRun): RunSummary {
  const patchCount = computePatchCount(run.config)

  // Backwards compat: old runs don't have simType
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- old runs lack simType
  const simType = run.simType ?? ('meta' as const)

  if (simType === 'field') {
    const fieldRun = run as Extract<SavedRun, { simType: 'field' }>
    return {
      simType: 'field',
      id: fieldRun.id,
      label: fieldRun.label,
      starred: fieldRun.starred,
      createdAt: fieldRun.createdAt,
      patchCount,
      normalizeStats: fieldRun.config.options.normalizeStats,
      noActives: fieldRun.config.options.noActives,
      noPassives: fieldRun.config.options.noPassives,
      syntheticMode: fieldRun.config.options.syntheticMode,
      trialsPerPair: fieldRun.config.options.trialsPerPair,
      creatureCount: fieldRun.result.result.creatureStats.length,
      giniCoefficient: fieldRun.result.result.scorecard.giniCoefficient,
      percentWithin45to55: fieldRun.result.result.scorecard.percentWithin45to55,
      config: fieldRun.config,
    }
  }

  // Meta run (default for backwards compat)
  const metaRun = run as Extract<SavedRun, { simType: 'meta' }>
  const lastSnap = metaRun.result.snapshots.at(-1)
  return {
    simType: 'meta',
    id: metaRun.id,
    label: metaRun.label,
    starred: metaRun.starred,
    createdAt: metaRun.createdAt,
    population: metaRun.config.options.population,
    generations: metaRun.config.options.generations,
    topFitness: lastSnap?.topFitness ?? 0,
    avgTurns: lastSnap?.avgTurns ?? 0,
    roleMetaShare: metaRun.result.result.roleMetaShare,
    patchCount,
    normalizeStats: metaRun.config.options.normalizeStats,
    noActives: metaRun.config.options.noActives,
    noPassives: metaRun.config.options.noPassives,
    syntheticMode: metaRun.config.options.syntheticMode,
    config: metaRun.config,
  }
}

export interface UseRunHistory {
  runs: Array<RunSummary>
  loading: boolean
  saveMetaRun: (
    config: {
      options: SimRequest['options']
      constants: ConstantsOverride
      creaturePatches: Array<CreatureOverridePatch>
    },
    result: MetaRunResult,
  ) => Promise<string>
  saveFieldRun: (
    config: {
      options: FieldSimRequest['options']
      constants: ConstantsOverride
      creaturePatches: Array<CreatureOverridePatch>
    },
    result: FieldRunResult,
  ) => Promise<string>
  getRun: (id: string) => Promise<SavedRun | undefined>
  getLatestRun: () => Promise<SavedRun | undefined>
  getLatestRunByType: (
    simType: 'meta' | 'field',
  ) => Promise<SavedRun | undefined>
  deleteRun: (id: string) => Promise<void>
  updateLabel: (id: string, label: string) => Promise<void>
  toggleStar: (id: string) => Promise<void>
  clearAll: () => Promise<void>
}

export function useRunHistory(): UseRunHistory {
  const [runs, setRuns] = useState<Array<RunSummary>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const db = await getDb()
      const all = await db.getAllFromIndex('runs', 'by-created')
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- race condition guard for async cleanup
      if (cancelled) return
      const summaries = all.reverse().map(toSummary)
      setRuns(summaries)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function persistRun(run: SavedRun): Promise<string> {
    const db = await getDb()
    await db.put('runs', run)

    // Auto-prune oldest non-starred runs beyond MAX_RUNS
    const all = await db.getAllKeysFromIndex('runs', 'by-created')
    if (all.length > MAX_RUNS) {
      const toCheck = all.slice(0, all.length - MAX_RUNS)
      for (const key of toCheck) {
        const r = await db.get('runs', key)
        if (r && !r.starred) {
          await db.delete('runs', key)
        }
      }
    }

    setRuns((prev) => [toSummary(run), ...prev].slice(0, MAX_RUNS))
    return run.id
  }

  const saveMetaRun = useCallback(
    async (
      config: {
        options: SimRequest['options']
        constants: ConstantsOverride
        creaturePatches: Array<CreatureOverridePatch>
      },
      result: MetaRunResult,
    ) => {
      const parts: Array<string> = [
        `pop=${config.options.population}`,
        `gen=${config.options.generations}`,
      ]
      if (config.options.normalizeStats) parts.push('normalized')
      if (config.options.noActives) parts.push('no-actives')
      if (config.options.noPassives) parts.push('no-passives')
      if (config.options.syntheticMode) parts.push('synthetic')

      const run: SavedRun = {
        simType: 'meta',
        id: nanoid(10),
        label: parts.join(' '),
        starred: false,
        createdAt: Date.now(),
        config,
        result,
      }

      return persistRun(run)
    },
    [],
  )

  const saveFieldRun = useCallback(
    async (
      config: {
        options: FieldSimRequest['options']
        constants: ConstantsOverride
        creaturePatches: Array<CreatureOverridePatch>
      },
      result: FieldRunResult,
    ) => {
      const parts: Array<string> = [
        `trials=${config.options.trialsPerPair}`,
        `teams=${config.options.teamSampleSize}`,
      ]
      if (config.options.normalizeStats) parts.push('normalized')
      if (config.options.noActives) parts.push('no-actives')
      if (config.options.noPassives) parts.push('no-passives')
      if (config.options.syntheticMode) parts.push('synthetic')

      const run: SavedRun = {
        simType: 'field',
        id: nanoid(10),
        label: parts.join(' '),
        starred: false,
        createdAt: Date.now(),
        config,
        result,
      }

      return persistRun(run)
    },
    [],
  )

  const getRun = useCallback(async (id: string) => {
    const db = await getDb()
    return db.get('runs', id)
  }, [])

  const getLatestRun = useCallback(async () => {
    const db = await getDb()
    const all = await db.getAllFromIndex('runs', 'by-created')
    return all.at(-1)
  }, [])

  const getLatestRunByType = useCallback(async (simType: 'meta' | 'field') => {
    const db = await getDb()
    const all = await db.getAllFromIndex('runs', 'by-created')
    // Backwards compat: old runs don't have simType, default to 'meta'
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- old runs lack simType
    return all.filter((r) => (r.simType ?? 'meta') === simType).at(-1)
  }, [])

  const deleteRun = useCallback(async (id: string) => {
    const db = await getDb()
    await db.delete('runs', id)
    setRuns((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const updateLabel = useCallback(async (id: string, label: string) => {
    const db = await getDb()
    const run = await db.get('runs', id)
    if (!run) return
    run.label = label
    await db.put('runs', run)
    setRuns((prev) => prev.map((r) => (r.id === id ? { ...r, label } : r)))
  }, [])

  const toggleStar = useCallback(async (id: string) => {
    const db = await getDb()
    const run = await db.get('runs', id)
    if (!run) return
    run.starred = !run.starred
    await db.put('runs', run)
    setRuns((prev) =>
      prev.map((r) => (r.id === id ? { ...r, starred: !r.starred } : r)),
    )
  }, [])

  const clearAll = useCallback(async () => {
    const db = await getDb()
    await db.clear('runs')
    setRuns([])
  }, [])

  return {
    runs,
    loading,
    saveMetaRun,
    saveFieldRun,
    getRun,
    getLatestRun,
    getLatestRunByType,
    deleteRun,
    updateLabel,
    toggleStar,
    clearAll,
  }
}
