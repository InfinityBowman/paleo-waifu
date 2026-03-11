import { useState } from 'react'
import { Wrench } from 'lucide-react'
import { useSession } from '@/lib/auth-client'

type ToolAction =
  | { action: 'add_fossils'; amount: number }
  | { action: 'force_pull'; rarity: string }
  | { action: 'reset_daily' }
  | { action: 'reset_arena' }
  | { action: 'set_rating'; rating: number }

const RARITIES = [
  { value: 'common', label: 'C', color: 'bg-zinc-600 hover:bg-zinc-500' },
  {
    value: 'uncommon',
    label: 'U',
    color: 'bg-emerald-700 hover:bg-emerald-600',
  },
  { value: 'rare', label: 'R', color: 'bg-blue-700 hover:bg-blue-600' },
  { value: 'epic', label: 'E', color: 'bg-purple-700 hover:bg-purple-600' },
  { value: 'legendary', label: 'L', color: 'bg-amber-600 hover:bg-amber-500' },
]

export function DevToolsPanel() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  if (!session) return null

  const userId = session.user.id

  async function callTool(key: string, body: ToolAction) {
    setLoading(key)
    setFeedback(null)
    try {
      const res = await fetch('/api/dev/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, userId }),
      })
      if (res.ok) {
        const data: { name?: string } = await res.json()
        setFeedback(data.name ? `Got ${data.name}` : key)
        setTimeout(() => setFeedback(null), 2000)
      } else {
        setFeedback('Error!')
        setTimeout(() => setFeedback(null), 2000)
      }
    } finally {
      setLoading(null)
    }
  }

  if (!open) {
    return (
      <div className="fixed right-4 bottom-4 z-50">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm transition-colors hover:bg-primary/25"
        >
          <Wrench className="h-3.5 w-3.5" />
          TOOLS
        </button>
      </div>
    )
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 w-64 rounded-lg border border-primary/30 bg-background/95 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between border-b border-primary/20 px-3 py-2">
        <span className="text-xs font-semibold text-primary">DEV TOOLS</span>
        {feedback && (
          <span
            className={`text-[10px] ${feedback === 'Error!' ? 'text-red-400' : 'text-emerald-400'}`}
          >
            {feedback}
          </span>
        )}
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <div className="space-y-0 divide-y divide-primary/10">
        {/* Fossils */}
        <div className="px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Fossils
          </span>
          <div className="mt-1 flex gap-1">
            {[10, 100, 1000].map((amt) => (
              <button
                key={amt}
                onClick={() =>
                  callTool(`fossils_${amt}`, {
                    action: 'add_fossils',
                    amount: amt,
                  })
                }
                disabled={loading !== null}
                className="flex-1 rounded bg-muted px-2 py-1 text-xs font-medium transition-colors hover:bg-muted/80 disabled:opacity-50"
              >
                +{amt}
              </button>
            ))}
          </div>
        </div>

        {/* Force Pull */}
        <div className="px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Force Pull
          </span>
          <div className="mt-1 flex gap-1">
            {RARITIES.map((r) => (
              <button
                key={r.value}
                onClick={() =>
                  callTool(`pull_${r.value}`, {
                    action: 'force_pull',
                    rarity: r.value,
                  })
                }
                disabled={loading !== null}
                className={`flex-1 rounded px-1 py-1 text-[10px] font-bold text-white transition-colors disabled:opacity-50 ${r.color}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Daily & Arena */}
        <div className="flex gap-1 px-3 py-2">
          <button
            onClick={() => callTool('daily', { action: 'reset_daily' })}
            disabled={loading !== null}
            className="flex-1 rounded bg-muted px-2 py-1 text-[10px] font-medium transition-colors hover:bg-muted/80 disabled:opacity-50"
          >
            Reset Daily
          </button>
          <button
            onClick={() => callTool('arena', { action: 'reset_arena' })}
            disabled={loading !== null}
            className="flex-1 rounded bg-muted px-2 py-1 text-[10px] font-medium transition-colors hover:bg-muted/80 disabled:opacity-50"
          >
            Reset Arena
          </button>
        </div>

        {/* Rating */}
        <div className="px-3 py-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Rating
          </span>
          <div className="mt-1 flex gap-1">
            {[0, 500, 1000, 2000].map((r) => (
              <button
                key={r}
                onClick={() =>
                  callTool(`rating_${r}`, {
                    action: 'set_rating',
                    rating: r,
                  })
                }
                disabled={loading !== null}
                className="flex-1 rounded bg-muted px-1 py-1 text-xs font-medium transition-colors hover:bg-muted/80 disabled:opacity-50"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
