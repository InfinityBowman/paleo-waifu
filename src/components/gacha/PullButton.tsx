import { useState } from 'react'
import { Pickaxe } from 'lucide-react'
import { useAppStore } from '@/store/appStore'
import { PULL_COST_MULTI, PULL_COST_SINGLE } from '@/lib/types'
import { Button } from '@/components/ui/button'

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
      <Button
        onClick={() => doPull('pull')}
        disabled={pulling || !canSingle}
        size="lg"
        className="h-11 px-5"
      >
        <Pickaxe className="h-5 w-5" />
        Pull x1
        <span className="text-xs opacity-70">({PULL_COST_SINGLE} 🦴)</span>
      </Button>
      <Button
        onClick={() => doPull('pull_multi')}
        disabled={pulling || !canMulti}
        variant="outline"
        size="lg"
        className="h-11 border-primary bg-primary/10 px-5 text-primary hover:bg-primary/20"
      >
        <Pickaxe className="h-5 w-5" />
        Pull x10
        <span className="text-xs opacity-70">({PULL_COST_MULTI} 🦴)</span>
      </Button>
    </div>
  )
}
