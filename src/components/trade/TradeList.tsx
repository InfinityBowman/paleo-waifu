import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { RARITY_COLORS, RARITY_BORDER, type Rarity } from '@/lib/types'
import { ArrowLeftRight, Plus, X, Loader2, Check, Clock } from 'lucide-react'

interface TradeItem {
  id: string
  offererId: string
  offererName: string
  offererImage: string | null
  offeredCreatureName: string
  offeredCreatureRarity: string
  offeredCreatureImage: string | null
  wantedCreatureId: string | null
  createdAt: Date | null
}

interface PendingTradeItem {
  id: string
  offererId: string
  receiverId: string | null
  offererName: string
  offererImage: string | null
  receiverName: string | null
  receiverImage: string | null
  offeredCreatureName: string
  offeredCreatureRarity: string
  receiverCreatureName: string | null
  receiverCreatureRarity: string | null
  createdAt: Date | null
}

interface MyCreature {
  id: string
  creatureId: string
  name: string
  rarity: string
  imageUrl: string | null
  isLocked: boolean | null
}

export function TradeList({
  trades,
  pendingTrades,
  myCreatures,
  userId,
}: {
  trades: TradeItem[]
  pendingTrades: PendingTradeItem[]
  myCreatures: MyCreature[]
  userId: string
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [pendingAccept, setPendingAccept] = useState<{
    tradeId: string
    myCreatureId: string
  } | null>(null)

  const handleCreate = async () => {
    if (!selectedOffer || loading) return
    setLoading('create')

    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          offeredCreatureId: selectedOffer,
        }),
      })

      if (res.ok) {
        setCreating(false)
        setSelectedOffer('')
        router.invalidate()
      }
    } finally {
      setLoading(null)
    }
  }

  const handleCancel = async (tradeId: string) => {
    if (loading) return
    setLoading(tradeId)

    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', tradeId }),
      })

      if (res.ok) router.invalidate()
    } finally {
      setLoading(null)
    }
  }

  const handleAccept = async () => {
    if (!pendingAccept || loading) return
    setLoading(pendingAccept.tradeId)

    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'accept',
          tradeId: pendingAccept.tradeId,
          myCreatureId: pendingAccept.myCreatureId,
        }),
      })

      if (res.ok) router.invalidate()
    } finally {
      setLoading(null)
      setPendingAccept(null)
    }
  }

  const handleConfirm = async (tradeId: string) => {
    if (loading) return
    setLoading(tradeId)

    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', tradeId }),
      })

      if (res.ok) router.invalidate()
    } finally {
      setLoading(null)
    }
  }

  const handleReject = async (tradeId: string) => {
    if (loading) return
    setLoading(tradeId)

    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', tradeId }),
      })

      if (res.ok) router.invalidate()
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Open Trades</h2>
        <button
          onClick={() => setCreating(!creating)}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Trade
        </button>
      </div>

      {creating && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 font-medium">Select a creature to offer</h3>
          <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4">
            {myCreatures.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedOffer(c.id)}
                className={cn(
                  'rounded-lg border p-3 text-left text-sm transition-all',
                  selectedOffer === c.id
                    ? 'border-primary bg-primary/10'
                    : 'hover:border-muted-foreground/30',
                )}
              >
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase',
                    RARITY_COLORS[c.rarity as Rarity],
                  )}
                >
                  {c.rarity}
                </span>
                <div className="font-medium">{c.name}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!selectedOffer || loading === 'create'}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading === 'create' && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Trade
            </button>
            <button
              onClick={() => {
                setCreating(false)
                setSelectedOffer('')
              }}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Confirmation dialog for proposing a trade */}
      {pendingAccept && (
        <div className="rounded-lg border border-primary bg-primary/5 p-4">
          <p className="mb-3 text-sm font-medium">
            Offer this creature? The trade owner will need to approve before it completes.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleAccept}
              disabled={loading === pendingAccept.tradeId}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading === pendingAccept.tradeId && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Send Offer
            </button>
            <button
              onClick={() => setPendingAccept(null)}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pending trades awaiting confirmation */}
      {pendingTrades.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-4 w-4 text-amber-500" />
            Pending Trades
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingTrades.map((trade) => {
              const iAmOfferer = trade.offererId === userId
              const offeredRarity = trade.offeredCreatureRarity as Rarity
              const receiverRarity = trade.receiverCreatureRarity as Rarity | null
              return (
                <div
                  key={trade.id}
                  className="rounded-lg border-2 border-amber-500/30 bg-card p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {trade.offererImage ? (
                        <img
                          src={trade.offererImage}
                          alt=""
                          className="h-5 w-5 rounded-full"
                        />
                      ) : null}
                      {trade.offererName}
                    </div>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                      PENDING
                    </span>
                  </div>

                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex-1">
                      <span
                        className={cn(
                          'text-[10px] font-semibold uppercase',
                          RARITY_COLORS[offeredRarity],
                        )}
                      >
                        {offeredRarity}
                      </span>
                      <div className="font-bold">{trade.offeredCreatureName}</div>
                    </div>
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 text-right">
                      {receiverRarity && (
                        <span
                          className={cn(
                            'text-[10px] font-semibold uppercase',
                            RARITY_COLORS[receiverRarity],
                          )}
                        >
                          {receiverRarity}
                        </span>
                      )}
                      <div className="font-bold">{trade.receiverCreatureName ?? '?'}</div>
                      <div className="text-xs text-muted-foreground">
                        from {trade.receiverName}
                      </div>
                    </div>
                  </div>

                  {iAmOfferer ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfirm(trade.id)}
                        disabled={loading === trade.id}
                        className="flex flex-1 items-center justify-center gap-1 rounded-md bg-green-600 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        {loading === trade.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Check className="h-3.5 w-3.5" />
                        )}
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(trade.id)}
                        disabled={loading === trade.id}
                        className="flex flex-1 items-center justify-center gap-1 rounded-md border py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        Decline
                      </button>
                    </div>
                  ) : (
                    <div className="text-center text-xs text-muted-foreground">
                      Waiting for {trade.offererName} to approve...
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {trades.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          No open trades. Be the first to create one!
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trades.map((trade) => {
            const rarity = trade.offeredCreatureRarity as Rarity
            const isMine = trade.offererId === userId
            return (
              <div
                key={trade.id}
                className={cn(
                  'rounded-lg border-2 bg-card p-4',
                  RARITY_BORDER[rarity],
                )}
              >
                <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                  {trade.offererImage ? (
                    <img
                      src={trade.offererImage}
                      alt=""
                      className="h-5 w-5 rounded-full"
                    />
                  ) : null}
                  {trade.offererName}
                </div>

                <div className="mb-3 flex items-center gap-3">
                  <div className="flex-1">
                    <span
                      className={cn(
                        'text-[10px] font-semibold uppercase',
                        RARITY_COLORS[rarity],
                      )}
                    >
                      {rarity}
                    </span>
                    <div className="font-bold">{trade.offeredCreatureName}</div>
                  </div>
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 text-right text-sm text-muted-foreground">
                    Open to offers
                  </div>
                </div>

                {isMine ? (
                  <button
                    onClick={() => handleCancel(trade.id)}
                    disabled={loading === trade.id}
                    className="flex w-full items-center justify-center gap-1 rounded-md border py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {loading === trade.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    Cancel
                  </button>
                ) : (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        setPendingAccept({
                          tradeId: trade.id,
                          myCreatureId: e.target.value,
                        })
                        e.target.value = ''
                      }
                    }}
                    disabled={!!loading}
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-sm disabled:opacity-50"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Offer a creature...
                    </option>
                    {myCreatures.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.rarity})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
