import { Cloud, LogOut, Plus } from 'lucide-react'
import type { Stats } from '../lib/types'

interface User {
  id: string
  name: string
  image: string | null
  role: string
}

export function Header({
  stats,
  user,
  onAddCreature,
  onR2,
  onLogout,
}: {
  stats: Stats | null
  user: User
  onAddCreature: () => void
  onR2: () => void
  onLogout: () => void
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
          onClick={onR2}
          className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Cloud className="h-4 w-4" />
          R2 Images
        </button>
        <div className="ml-2 flex items-center gap-2 border-l border-border pl-4">
          {user.image && (
            <img src={user.image} alt="" className="h-7 w-7 rounded-full" />
          )}
          <span className="text-sm text-muted-foreground">{user.name}</span>
          <button
            onClick={onLogout}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
