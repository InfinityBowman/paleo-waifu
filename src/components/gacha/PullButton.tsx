import { useState } from 'react'
import { useAppStore } from '@/store/appStore'
import { PULL_COST_SINGLE, PULL_COST_MULTI } from '@/lib/types'
import { Pickaxe } from 'lucide-react'

export function PullButton({ bannerId }: { bannerId: string }) {
  const [pulling, setPulling] = useState(false)
  const store = useAppStore()

  const doPull = async (action: 'pull' | 'pull_multi') => {
    if (!bannerId) return

    setPulling(true)
    store.setIsPulling(true)
    store.clearPullResults()

    try {
      const res = await fetch('/api/gacha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, bannerId }),
      })

      const data = await res.json()
      if (!res.ok) {
        console.error(data.error)
        if (data.fossils != null) store.setFossils(data.fossils)
        return
      }

      store.setPullResults(data.results)
      store.setFossils(data.fossils)
    } finally {
      setPulling(false)
      store.setIsPulling(false)
    }
  }

  const canSingle = store.fossils >= PULL_COST_SINGLE
  const canMulti = store.fossils >= PULL_COST_MULTI

  return (
    <div className="flex gap-3">
      <button
        onClick={() => doPull('pull')}
        disabled={pulling || !canSingle}
        className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Pickaxe className="h-5 w-5" />
        Pull x1
        <span className="text-xs opacity-70">({PULL_COST_SINGLE} 🦴)</span>
      </button>
      <button
        onClick={() => doPull('pull_multi')}
        disabled={pulling || !canMulti}
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-primary bg-primary/10 px-5 font-medium text-primary transition-all hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Pickaxe className="h-5 w-5" />
        Pull x10
        <span className="text-xs opacity-70">({PULL_COST_MULTI} 🦴)</span>
      </button>
    </div>
  )
}
