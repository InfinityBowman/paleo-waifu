import { useState } from 'react'
import { PULL_COST_MULTI, PULL_COST_SINGLE } from '@paleo-waifu/shared/types'
import type { PullResult } from '@/lib/gacha'
import { IconDinosaurBones, IconMining } from '@/components/icons'
import { useAppStore } from '@/store/appStore'
import { Button } from '@/components/ui/button'

export function PullButton({
  bannerId,
  fossils,
  onFossilsChange,
}: {
  bannerId: string
  fossils: number
  onFossilsChange: (fossils: number) => void
}) {
  const [pulling, setPulling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const store = useAppStore()

  const doPull = async (action: 'pull' | 'pull_multi') => {
    if (!bannerId) return

    setPulling(true)
    setError(null)
    store.setIsPulling(true)
    store.clearPullResults()

    const minExcavation = new Promise((r) => setTimeout(r, 1500))

    try {
      const [, res] = await Promise.all([
        minExcavation,
        fetch('/api/gacha', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, bannerId }),
        }),
      ])

      const data: {
        error?: string
        fossils?: number
        results?: Array<PullResult>
      } = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Pull failed')
        if (data.fossils != null) onFossilsChange(data.fossils)
        return
      }

      if (data.results) store.setPullResults(data.results)
      if (data.fossils != null) onFossilsChange(data.fossils)
    } catch {
      setError('Network error — please try again')
    } finally {
      setPulling(false)
      store.setIsPulling(false)
    }
  }

  const canSingle = fossils >= PULL_COST_SINGLE
  const canMulti = fossils >= PULL_COST_MULTI

  return (
    <div className="flex flex-col items-end gap-2">
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-3">
        <Button
          onClick={() => doPull('pull')}
          disabled={pulling || !canSingle}
          size="lg"
          className="group h-12 px-5"
        >
          <IconMining className="h-5 w-5 transition-transform group-hover:rotate-[-20deg]" />
          <span className="font-display">Pull x1</span>
          <span className="flex items-center gap-0.5 text-xs opacity-70">
            ({PULL_COST_SINGLE} <IconDinosaurBones className="h-3 w-3" />)
          </span>
        </Button>
        <Button
          onClick={() => doPull('pull_multi')}
          disabled={pulling || !canMulti}
          variant="outline"
          size="lg"
          className="group relative h-12 overflow-hidden border-primary bg-primary/10 px-5 text-primary hover:bg-primary/20"
        >
          <IconMining className="h-5 w-5 transition-transform group-hover:rotate-[-20deg]" />
          <span className="font-display">Pull x10</span>
          <span className="flex items-center gap-0.5 text-xs opacity-70">
            ({PULL_COST_MULTI} <IconDinosaurBones className="h-3 w-3" />)
          </span>
          {/* Shimmer on hover */}
          <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100 rarity-shimmer-legendary" />
        </Button>
      </div>
    </div>
  )
}
