import { useState } from 'react'
import { Bone, Pickaxe } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import type { PullResult } from '@/lib/gacha'
import { PULL_COST_MULTI, PULL_COST_SINGLE } from '@/lib/types'
import { Button } from '@/components/ui/button'

export function PullButton({ bannerId }: { bannerId: string }) {
  const [pulling, setPulling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const store = useAppStore()

  const doPull = async (action: 'pull' | 'pull_multi') => {
    if (!bannerId) return

    setPulling(true)
    setError(null)
    store.setIsPulling(true)
    store.clearPullResults()

    try {
      const res = await fetch('/api/gacha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, bannerId }),
      })

      const data = (await res.json()) as {
        error?: string
        fossils?: number
        results?: Array<PullResult>
      }
      if (!res.ok) {
        setError(data.error ?? 'Pull failed')
        if (data.fossils != null) store.setFossils(data.fossils)
        return
      }

      if (data.results) store.setPullResults(data.results)
      if (data.fossils != null) store.setFossils(data.fossils)
    } catch {
      setError('Network error — please try again')
    } finally {
      setPulling(false)
      store.setIsPulling(false)
    }
  }

  const canSingle = (store.fossils ?? 0) >= PULL_COST_SINGLE
  const canMulti = (store.fossils ?? 0) >= PULL_COST_MULTI

  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      <div className="flex gap-3">
      <Button
        onClick={() => doPull('pull')}
        disabled={pulling || !canSingle}
        size="lg"
        className="group h-12 px-5"
      >
        <Pickaxe className="h-5 w-5 transition-transform group-hover:rotate-[-20deg]" />
        <span className="font-display">Pull x1</span>
        <span className="flex items-center gap-0.5 text-xs opacity-70">
          ({PULL_COST_SINGLE} <Bone className="h-3 w-3" />)
        </span>
      </Button>
      <Button
        onClick={() => doPull('pull_multi')}
        disabled={pulling || !canMulti}
        variant="outline"
        size="lg"
        className="group relative h-12 overflow-hidden border-primary bg-primary/10 px-5 text-primary hover:bg-primary/20"
      >
        <Pickaxe className="h-5 w-5 transition-transform group-hover:rotate-[-20deg]" />
        <span className="font-display">Pull x10</span>
        <span className="flex items-center gap-0.5 text-xs opacity-70">
          ({PULL_COST_MULTI} <Bone className="h-3 w-3" />)
        </span>
        {/* Shimmer on hover */}
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 rarity-shimmer-legendary" />
      </Button>
      </div>
    </div>
  )
}
