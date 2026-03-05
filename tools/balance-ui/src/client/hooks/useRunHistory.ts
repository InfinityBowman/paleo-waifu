import { useCallback, useEffect, useState } from 'react'
import { nanoid } from 'nanoid'
import { getDb } from '../lib/db'
import type {
  ConstantsOverride,
  CreatureOverridePatch,
  MetaRunResult,
  RunSummary,
  SavedRun,
  SimRequest,
} from '../../shared/types.ts'

const MAX_RUNS = 50

function toSummary(run: SavedRun): RunSummary {
  const lastSnap = run.result.snapshots.at(-1)
  const patchCount =
    run.config.creaturePatches.filter((p) => Object.keys(p).length > 1)
      .length + Object.keys(run.config.constants).length

  return {
    id: run.id,
    label: run.label,
    starred: run.starred,
    createdAt: run.createdAt,
    population: run.config.options.population,
    generations: run.config.options.generations,
    topFitness: lastSnap?.topFitness ?? 0,
    avgTurns: lastSnap?.avgTurns ?? 0,
    roleMetaShare: run.result.result.roleMetaShare,
    patchCount,
    normalizeStats: run.config.options.normalizeStats,
    noActives: run.config.options.noActives,
    noPassives: run.config.options.noPassives,
  }
}

export interface UseRunHistory {
  runs: Array<RunSummary>
  loading: boolean
  saveRun: (
    config: {
      options: SimRequest['options']
      constants: ConstantsOverride
      creaturePatches: Array<CreatureOverridePatch>
    },
    result: MetaRunResult,
  ) => Promise<string>
  getRun: (id: string) => Promise<SavedRun | undefined>
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
      if (cancelled) return
      // Reverse so newest is first
      const summaries = all.reverse().map(toSummary)
      setRuns(summaries)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const saveRun = useCallback(
    async (
      config: {
        options: SimRequest['options']
        constants: ConstantsOverride
        creaturePatches: Array<CreatureOverridePatch>
      },
      result: MetaRunResult,
    ) => {
      const db = await getDb()
      const id = nanoid(10)

      // Build label from config
      const parts: Array<string> = [
        `pop=${config.options.population}`,
        `gen=${config.options.generations}`,
      ]
      if (config.options.normalizeStats) parts.push('normalized')
      if (config.options.noActives) parts.push('no-actives')
      if (config.options.noPassives) parts.push('no-passives')

      const run: SavedRun = {
        id,
        label: parts.join(' '),
        starred: false,
        createdAt: Date.now(),
        config,
        result,
      }

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
      return id
    },
    [],
  )

  const getRun = useCallback(async (id: string) => {
    const db = await getDb()
    return db.get('runs', id)
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
    setRuns((prev) =>
      prev.map((r) => (r.id === id ? { ...r, label } : r)),
    )
  }, [])

  const toggleStar = useCallback(async (id: string) => {
    const db = await getDb()
    const run = await db.get('runs', id)
    if (!run) return
    run.starred = !run.starred
    await db.put('runs', run)
    setRuns((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, starred: !r.starred } : r,
      ),
    )
  }, [])

  const clearAll = useCallback(async () => {
    const db = await getDb()
    await db.clear('runs')
    setRuns([])
  }, [])

  return { runs, loading, saveRun, getRun, deleteRun, updateLabel, toggleStar, clearAll }
}
