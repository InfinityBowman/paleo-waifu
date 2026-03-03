import { Plus, Settings } from 'lucide-react'
import type { Stats } from '../lib/types'

export function Header({
  stats,
  onAddCreature,
  onSeed,
}: {
  stats: Stats | null
  onAddCreature: () => void
  onSeed: () => void
}) {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-foreground">Creature Editor</h1>
        {stats && (
          <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground">
            {stats.total} creatures
            {stats.missingImages > 0 && (
              <span className="ml-1 text-warning">
                ({stats.missingImages} missing images)
              </span>
            )}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onAddCreature}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Creature
        </button>
        <button
          onClick={onSeed}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Settings className="h-4 w-4" />
          Seed & Sync
        </button>
      </div>
    </header>
  )
}
