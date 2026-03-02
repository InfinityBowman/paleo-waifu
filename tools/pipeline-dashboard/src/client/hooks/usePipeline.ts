import { useState, useEffect, useCallback, useRef } from 'react'
import type { StageWithState } from '../lib/types'
import { fetchPipeline } from '../lib/api'

export function usePipeline() {
  const [stages, setStages] = useState<StageWithState[]>([])
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined)

  const refresh = useCallback(async () => {
    try {
      const data = await fetchPipeline()
      setStages(data.stages)
    } catch (err) {
      console.error('Failed to fetch pipeline:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, 1000)
    return () => clearInterval(intervalRef.current)
  }, [refresh])

  const hasRunning = stages.some((s) => s.state.status === 'running')
  const completedCount = stages.filter(
    (s) => s.state.status === 'success',
  ).length

  return { stages, loading, hasRunning, completedCount }
}
