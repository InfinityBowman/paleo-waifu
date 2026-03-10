import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Rarity } from '@paleo-waifu/shared/types'
import { IconCardExchange } from '@/components/icons'
import { cn } from '@/lib/utils'
import { RARITY_BORDER, RARITY_COLORS } from '@/lib/rarity-styles'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { loadMoreOpenTrades } from '@/routes/_app/trade'

export interface TradeItem {
  id: string
  offererId: string
  offererName: string
  offererImage: string | null
  offeredCreatureBaseId: string
  offeredCreatureName: string
  offeredCreatureRarity: string
  offeredCreatureImage: string | null
  wantedCreatureId: string | null
  createdAt: Date | null
}

interface TradeMarketplaceProps {
  trades: Array<TradeItem>
  userId: string
  loading: string | null
  hasMore: boolean
  incomingCountByTrade: Map<string, number>
  onCancel: (tradeId: string) => void
  onPropose: (tradeId: string) => void
  onPreview: (creatureBaseId: string) => void
}

export function TradeMarketplace({
  trades,
  userId,
  loading,
  hasMore: initialHasMore,
  incomingCountByTrade,
  onCancel,
  onPropose,
  onPreview,
}: TradeMarketplaceProps) {
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
    <div className="space-y-4">
      <h3 className="font-display flex items-center gap-2 text-base font-semibold">
        <IconCardExchange className="h-4 w-4 text-blue-300" />
        Browse Trades
      </h3>
      {allTrades.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No open trades. Be the first to create one!
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allTrades.map((trade) => {
              const rarity = trade.offeredCreatureRarity as Rarity
              const isMine = trade.offererId === userId
              const proposalCount = incomingCountByTrade.get(trade.id) ?? 0
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
                      {isMine && proposalCount > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-auto bg-primary/15 text-primary"
                        >
                          {proposalCount}{' '}
                          {proposalCount === 1 ? 'offer' : 'offers'}
                        </Badge>
                      )}
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
                        <button
                          className="font-display block font-bold underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:decoration-current"
                          onClick={() => onPreview(trade.offeredCreatureBaseId)}
                        >
                          {trade.offeredCreatureName}
                        </button>
                      </div>
                      <IconCardExchange className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1 text-right text-sm text-muted-foreground">
                        Open to offers
                      </div>
                    </div>

                    {isMine ? (
                      <Button
                        variant="destructive"
                        onClick={() => onCancel(trade.id)}
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
                      <Button
                        variant="outline"
                        onClick={() => onPropose(trade.id)}
                        disabled={!!loading}
                        className="w-full"
                        size="sm"
                      >
                        Make Offer
                      </Button>
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
