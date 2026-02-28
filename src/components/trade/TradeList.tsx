import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Loader2, Plus, X } from 'lucide-react'
import type { Rarity } from '@/lib/types'
import {
  IconCardExchange,
  IconCheckMark,
  IconHourglass,
} from '@/components/icons'
import { cn } from '@/lib/utils'
import { RARITY_BG, RARITY_BORDER, RARITY_COLORS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { loadMoreOpenTrades } from '@/routes/_app/trade'

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
  offererName: string | null
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
  hasMore: initialHasMore,
}: {
  trades: Array<TradeItem>
  pendingTrades: Array<PendingTradeItem>
  myCreatures: Array<MyCreature>
  userId: string
  hasMore: boolean
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [pendingAccept, setPendingAccept] = useState<{
    tradeId: string
    myCreatureId: string
  } | null>(null)

  // Pagination state
  const [extraTrades, setExtraTrades] = useState<Array<TradeItem>>([])
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingMore, setLoadingMore] = useState(false)

  // Reset pagination state when loader data refreshes
  const tradesRef = useRef(trades)
  useEffect(() => {
    if (tradesRef.current !== trades) {
      tradesRef.current = trades
      setExtraTrades([])
      setHasMore(initialHasMore)
    }
  }, [trades, initialHasMore])

  const allTrades = [...trades, ...extraTrades]

  const tradeAction = async (
    body: Record<string, string>,
    loadingKey: string,
    onSuccess?: () => void,
  ) => {
    if (loading) return
    setLoading(loadingKey)
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        onSuccess?.()
        await router.invalidate()
      } else {
        let message = 'Something went wrong. Please try again.'
        try {
          const data: { error?: string } = await res.json()
          if (data.error) message = data.error
        } catch {
          // body not JSON, use default message
        }
        toast.error(message)
      }
    } catch {
      toast.error('Network error. Please check your connection.')
    } finally {
      setLoading(null)
    }
  }

  const handleCreate = async () => {
    if (!selectedOffer) return
    await tradeAction(
      { action: 'create', offeredCreatureId: selectedOffer },
      'create',
      () => {
        setCreating(false)
        setSelectedOffer('')
      },
    )
  }

  const handleCancel = (tradeId: string) =>
    tradeAction({ action: 'cancel', tradeId }, tradeId)

  const handleAccept = async () => {
    if (!pendingAccept) return
    await tradeAction(
      {
        action: 'accept',
        tradeId: pendingAccept.tradeId,
        myCreatureId: pendingAccept.myCreatureId,
      },
      pendingAccept.tradeId,
    )
    setPendingAccept(null)
  }

  const handleConfirm = (tradeId: string) =>
    tradeAction({ action: 'confirm', tradeId }, tradeId)

  const handleReject = (tradeId: string) =>
    tradeAction({ action: 'reject', tradeId }, tradeId)

  const handleWithdraw = (tradeId: string) =>
    tradeAction({ action: 'withdraw', tradeId }, tradeId)

  const handleLoadMore = useCallback(async () => {
    if (allTrades.length === 0 || loadingMore) return
    const lastTrade = allTrades[allTrades.length - 1]
    if (!lastTrade.createdAt) return
    setLoadingMore(true)
    try {
      const result = await loadMoreOpenTrades({
        data: { cursor: new Date(lastTrade.createdAt).getTime() },
      })
      setExtraTrades((prev) => [...prev, ...result.trades])
      setHasMore(result.hasMore)
    } catch {
      toast.error('Failed to load more trades.')
    } finally {
      setLoadingMore(false)
    }
  }, [allTrades, loadingMore])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Open Trades</h2>
        <Button onClick={() => setCreating(!creating)} size="lg">
          <Plus className="h-4 w-4" />
          New Trade
        </Button>
      </div>

      {creating && (
        <Card>
          <CardContent>
            <h3 className="font-display mb-3 font-medium">
              Select a creature to offer
            </h3>
            <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4">
              {myCreatures.map((c) => {
                const rarity = c.rarity as Rarity
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelectedOffer(c.id)}
                    className={cn(
                      'relative rounded-xl border-2 p-3 text-left text-sm transition-all',
                      selectedOffer === c.id
                        ? 'border-primary bg-primary/10'
                        : cn(
                            'hover:border-muted-foreground/30',
                            RARITY_BG[rarity],
                          ),
                    )}
                  >
                    <span
                      className={cn(
                        'font-display text-[10px] font-semibold uppercase',
                        RARITY_COLORS[rarity],
                      )}
                    >
                      {c.rarity}
                    </span>
                    <div className="font-display font-medium">{c.name}</div>
                    {selectedOffer === c.id && (
                      <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={!selectedOffer || loading === 'create'}
              >
                {loading === 'create' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Create Trade
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setCreating(false)
                  setSelectedOffer('')
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation dialog for proposing a trade */}
      <AlertDialog
        open={!!pendingAccept}
        onOpenChange={(open) => {
          if (!open) setPendingAccept(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Trade Offer</AlertDialogTitle>
            <AlertDialogDescription>
              Offer this creature? The trade owner will need to approve before
              it completes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAccept}
              disabled={!!pendingAccept && loading === pendingAccept.tradeId}
            >
              {pendingAccept && loading === pendingAccept.tradeId && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Send Offer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Pending trades awaiting confirmation */}
      {pendingTrades.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display flex items-center gap-2 text-lg font-semibold">
            <IconHourglass className="h-4 w-4 text-primary" />
            Pending Trades
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pendingTrades.map((trade) => {
              const iAmOfferer = trade.offererId === userId
              const offeredRarity = trade.offeredCreatureRarity as Rarity
              const receiverRarity =
                trade.receiverCreatureRarity as Rarity | null
              return (
                <Card key={trade.id} className="border-2 border-primary/30">
                  <CardContent>
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
                      <Badge
                        variant="secondary"
                        className="bg-primary/15 text-primary"
                      >
                        PENDING
                      </Badge>
                    </div>

                    <div className="mb-3 flex items-center gap-3">
                      <div className="flex-1">
                        <span
                          className={cn(
                            'font-display text-[10px] font-semibold uppercase',
                            RARITY_COLORS[offeredRarity],
                          )}
                        >
                          {offeredRarity}
                        </span>
                        <div className="font-display font-bold">
                          {trade.offeredCreatureName}
                        </div>
                      </div>
                      <IconCardExchange className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 text-right">
                        {receiverRarity && (
                          <span
                            className={cn(
                              'font-display text-[10px] font-semibold uppercase',
                              RARITY_COLORS[receiverRarity],
                            )}
                          >
                            {receiverRarity}
                          </span>
                        )}
                        <div className="font-display font-bold">
                          {trade.receiverCreatureName ?? '?'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          from {trade.receiverName}
                        </div>
                      </div>
                    </div>

                    {iAmOfferer ? (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleConfirm(trade.id)}
                          disabled={loading === trade.id}
                          className="flex-1 bg-primary text-white hover:bg-primary/90"
                          size="sm"
                        >
                          {loading === trade.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <IconCheckMark className="h-3.5 w-3.5" />
                          )}
                          Accept
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleReject(trade.id)}
                          disabled={loading === trade.id}
                          className="flex-1"
                          size="sm"
                        >
                          <X className="h-3.5 w-3.5" />
                          Decline
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-center text-xs text-muted-foreground">
                          Waiting for {trade.offererName} to approve...
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => handleWithdraw(trade.id)}
                          disabled={loading === trade.id}
                          className="w-full"
                          size="sm"
                        >
                          {loading === trade.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <X className="h-3.5 w-3.5" />
                          )}
                          Withdraw
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {allTrades.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No open trades. Be the first to create one!
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allTrades.map((trade) => {
              const rarity = trade.offeredCreatureRarity as Rarity
              const isMine = trade.offererId === userId
              return (
                <Card
                  key={trade.id}
                  className={cn('border-2', RARITY_BORDER[rarity])}
                >
                  <CardContent>
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
                            'font-display text-[10px] font-semibold uppercase',
                            RARITY_COLORS[rarity],
                          )}
                        >
                          {rarity}
                        </span>
                        <div className="font-display font-bold">
                          {trade.offeredCreatureName}
                        </div>
                      </div>
                      <IconCardExchange className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 text-right text-sm text-muted-foreground">
                        Open to offers
                      </div>
                    </div>

                    {isMine ? (
                      <Button
                        variant="destructive"
                        onClick={() => handleCancel(trade.id)}
                        disabled={loading === trade.id}
                        className="w-full"
                        size="sm"
                      >
                        {loading === trade.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                        Cancel
                      </Button>
                    ) : (
                      <Select
                        onValueChange={(value) => {
                          if (value) {
                            setPendingAccept({
                              tradeId: trade.id,
                              myCreatureId: value,
                            })
                          }
                        }}
                      >
                        <SelectTrigger className="w-full" disabled={!!loading}>
                          <SelectValue placeholder="Offer a creature..." />
                        </SelectTrigger>
                        <SelectContent>
                          {myCreatures.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name} ({c.rarity})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more trades
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
