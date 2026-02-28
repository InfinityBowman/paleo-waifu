import { useState } from 'react'
import { Bug } from 'lucide-react'
import { useSession } from '@/lib/auth-client'

const DEV_USERS = [
  { id: 'dev-user-1', name: 'DinoLover', fossils: 20, purpose: 'New player' },
  {
    id: 'dev-user-2',
    name: 'FossilQueen',
    fossils: 150,
    purpose: 'Mid-game',
  },
  { id: 'dev-user-3', name: 'MesozoicMax', fossils: 500, purpose: 'Whale' },
  {
    id: 'dev-user-4',
    name: 'TradeTyrant',
    fossils: 75,
    purpose: 'Trade-focused',
  },
]

export function DevAccountSwitcher() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function switchUser(userId: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/dev/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (res.ok) {
        window.location.reload()
      } else {
        const data = (await res.json()) as { error?: string }
        console.error('Dev switch failed:', data.error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {open ? (
        <div className="w-72 rounded-lg border border-amber-500/30 bg-background/95 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between border-b border-amber-500/20 px-3 py-2">
            <span className="text-xs font-semibold text-amber-500">
              DEV ACCOUNT SWITCHER
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1 p-2">
            {DEV_USERS.map((u) => {
              const isActive = session?.user?.id === u.id
              return (
                <button
                  key={u.id}
                  onClick={() => switchUser(u.id)}
                  disabled={loading || isActive}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    isActive
                      ? 'bg-amber-500/15 text-amber-500'
                      : 'hover:bg-muted'
                  } disabled:opacity-50`}
                >
                  <img
                    src={`https://api.dicebear.com/9.x/thumbs/svg?seed=${u.name}`}
                    alt={u.name}
                    className="h-8 w-8 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{u.name}</span>
                      {isActive && (
                        <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-500">
                          active
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {u.fossils} fossils &middot; {u.purpose}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-500 shadow-sm transition-colors hover:bg-amber-500/25"
        >
          <Bug className="h-3.5 w-3.5" />
          DEV
        </button>
      )}
    </div>
  )
}
