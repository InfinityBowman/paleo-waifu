import { useState } from 'react'
import { Bug } from 'lucide-react'
import { useSession } from '@/lib/auth-client'

const DEV_USERS = [
  {
    id: 'dev-user-1',
    name: 'DinoLover',
    fossils: 20,
    purpose: 'New player',
    avatar: 0,
  },
  {
    id: 'dev-user-2',
    name: 'FossilQueen',
    fossils: 150,
    purpose: 'Mid-game',
    avatar: 1,
  },
  {
    id: 'dev-user-3',
    name: 'MesozoicMax',
    fossils: 500,
    purpose: 'Whale',
    avatar: 2,
  },
  {
    id: 'dev-user-4',
    name: 'TradeTyrant',
    fossils: 75,
    purpose: 'Trade-focused',
    avatar: 3,
  },
  {
    id: 'dev-user-5',
    name: 'AdminRex',
    fossils: 9999,
    purpose: 'Admin',
    avatar: 4,
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
        const data: { error?: string } = await res.json()
        console.error('Dev switch failed:', data.error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 left-4 z-50">
      {open ? (
        <div className="w-72 rounded-lg border border-primary/30 bg-background/95 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between border-b border-primary/20 px-3 py-2">
            <span className="text-xs font-semibold text-primary">
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
              const isActive = session?.user.id === u.id
              return (
                <button
                  key={u.id}
                  onClick={() => switchUser(u.id)}
                  disabled={loading || isActive}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    isActive ? 'bg-primary/15 text-primary' : 'hover:bg-muted'
                  } disabled:opacity-50`}
                >
                  <img
                    src={`https://cdn.discordapp.com/embed/avatars/${u.avatar}.png`}
                    alt={u.name}
                    className="h-8 w-8 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{u.name}</span>
                      {isActive && (
                        <span className="shrink-0 rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
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
          className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary shadow-sm transition-colors hover:bg-primary/25"
        >
          <Bug className="h-3.5 w-3.5" />
          DEV
        </button>
      )}
    </div>
  )
}
