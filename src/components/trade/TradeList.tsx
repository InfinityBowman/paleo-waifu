import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Loader2, Plus, X } from 'lucide-react'
import type { Rarity } from '@/lib/types'
import type { PickerCreature } from '@/components/shared/CreaturePickerModal'
import {
  IconCardExchange,
  IconCheckMark,
  IconHourglass,
} from '@/components/icons'
import { cn } from '@/lib/utils'
import { RARITY_BORDER, RARITY_COLORS } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { CreaturePickerModal } from '@/components/shared/CreaturePickerModal'
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

interface MyProposalItem {
  proposalId: string
  tradeId: string
  proposerCreatureId: string
  createdAt: Date | null
  tradeOwnerName: string | null
  tradeOwnerImage: string | null
  tradeCreatureName: string
  tradeCreatureRarity: string
  proposerCreatureName: string
  proposerCreatureRarity: string
}

interface IncomingProposalItem {
  proposalId: string
  tradeId: string
  proposerId: string
  proposerCreatureId: string
  createdAt: Date | null
  proposerName: string | null
  proposerImage: string | null
  proposerCreatureName: string
  proposerCreatureRarity: string
  tradeCreatureName: string
  tradeCreatureRarity: string
}

interface MyCreature {
  id: string
  creatureId: string
  name: string
  rarity: string
  imageUrl: string | null
  imageAspectRatio: number | null
  isLocked: boolean | null
}

export function TradeList({
  trades,
  myProposals,
  incomingProposals,
  myCreatures,
  userId,
  hasMore: initialHasMore,
}: {
  trades: Array<TradeItem>
  myProposals: Array<MyProposalItem>
  incomingProposals: Array<IncomingProposalItem>
  myCreatures: Array<MyCreature>
  userId: string
  hasMore: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmProposal, setConfirmProposal] = useState<{
    tradeId: string
    proposalId: string
    proposerName: string | null
    proposerCreatureName: string
  } | null>(null)
  const [createPickerOpen, setCreatePickerOpen] = useState(false)
  const [proposePickerTradeId, setProposePickerTradeId] = useState<
    string | null
  >(null)

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

  const handleCreate = async (creatureId: string) => {
    await tradeAction(
      { action: 'create', offeredCreatureId: creatureId },
      'create',
    )
  }

  const handleCancel = (tradeId: string) =>
    tradeAction({ action: 'cancel', tradeId }, tradeId)

  const handlePropose = async (tradeId: string, myCreatureId: string) => {
    await tradeAction(
      { action: 'propose', tradeId, myCreatureId },
      `propose-${tradeId}`,
    )
  }

  const handleConfirmProposal = async () => {
    if (!confirmProposal) return
    await tradeAction(
      {
        action: 'confirm',
        tradeId: confirmProposal.tradeId,
        proposalId: confirmProposal.proposalId,
      },
      confirmProposal.proposalId,
    )
    setConfirmProposal(null)
  }

  const handleWithdraw = (proposalId: string) =>
    tradeAction({ action: 'withdraw', proposalId }, proposalId)

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

  // Group incoming proposals by tradeId for display
  const incomingByTrade = new Map<string, Array<IncomingProposalItem>>()
  for (const p of incomingProposals) {
    const arr = incomingByTrade.get(p.tradeId) ?? []
    arr.push(p)
    incomingByTrade.set(p.tradeId, arr)
  }

  const myOffersCount = incomingProposals.length + myProposals.length

  return (
    <div className="space-y-4">
      {/* Confirmation dialog for accepting a proposal */}
      <AlertDialog
        open={!!confirmProposal}
        onOpenChange={(open) => {
          if (!open) setConfirmProposal(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept Trade</AlertDialogTitle>
            <AlertDialogDescription>
              Accept {confirmProposal?.proposerName}&apos;s offer of{' '}
              <strong>{confirmProposal?.proposerCreatureName}</strong>? This
              will complete the swap and cancel all other proposals on this
              trade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmProposal}
              disabled={
                !!confirmProposal && loading === confirmProposal.proposalId
              }
            >
              {confirmProposal && loading === confirmProposal.proposalId && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              Accept Trade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="marketplace">
        <div className="flex items-center justify-between">
          <TabsList variant="glass">
            <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
            <TabsTrigger value="my-offers">
              My Offers
              {myOffersCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1.5 h-5 min-w-5 rounded-full bg-primary/20 px-1.5 text-[10px] text-primary"
                >
                  {myOffersCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          <Button
            onClick={() => setCreatePickerOpen(true)}
            disabled={!!loading}
            size="lg"
          >
            <Plus className="h-4 w-4" />
            New Trade
          </Button>
        </div>

        <TabsContent value="marketplace" className="space-y-4">
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
                  const proposalCount =
                    incomingByTrade.get(trade.id)?.length ?? 0
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
                          <Button
                            variant="outline"
                            onClick={() => setProposePickerTradeId(trade.id)}
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
                    {loadingMore && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                    Load more trades
                  </Button>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="my-offers" className="space-y-6">
          {/* Incoming proposals on MY trades */}
          {incomingProposals.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display flex items-center gap-2 text-base font-semibold">
                <IconHourglass className="h-4 w-4 text-primary" />
                Incoming Offers
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {incomingProposals.map((proposal) => {
                  const proposerRarity =
                    proposal.proposerCreatureRarity as Rarity
                  const tradeRarity = proposal.tradeCreatureRarity as Rarity
                  return (
                    <Card
                      key={proposal.proposalId}
                      className="border-2 border-primary/30"
                    >
                      <CardContent>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {proposal.proposerImage ? (
                              <img
                                src={proposal.proposerImage}
                                alt=""
                                className="h-5 w-5 rounded-full"
                              />
                            ) : null}
                            {proposal.proposerName}
                          </div>
                          <Badge
                            variant="secondary"
                            className="bg-primary/15 text-primary"
                          >
                            OFFER
                          </Badge>
                        </div>

                        <div className="mb-3 flex items-center gap-3">
                          <div className="flex-1">
                            <span
                              className={cn(
                                'font-display text-[10px] font-semibold uppercase',
                                RARITY_COLORS[tradeRarity],
                              )}
                            >
                              {tradeRarity}
                            </span>
                            <div className="font-display font-bold">
                              {proposal.tradeCreatureName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Your creature
                            </div>
                          </div>
                          <IconCardExchange className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 text-right">
                            <span
                              className={cn(
                                'font-display text-[10px] font-semibold uppercase',
                                RARITY_COLORS[proposerRarity],
                              )}
                            >
                              {proposerRarity}
                            </span>
                            <div className="font-display font-bold">
                              {proposal.proposerCreatureName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              from {proposal.proposerName}
                            </div>
                          </div>
                        </div>

                        <Button
                          onClick={() =>
                            setConfirmProposal({
                              tradeId: proposal.tradeId,
                              proposalId: proposal.proposalId,
                              proposerName: proposal.proposerName,
                              proposerCreatureName:
                                proposal.proposerCreatureName,
                            })
                          }
                          disabled={loading === proposal.proposalId}
                          className="w-full bg-primary text-white hover:bg-primary/90"
                          size="sm"
                        >
                          {loading === proposal.proposalId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <IconCheckMark className="h-3.5 w-3.5" />
                          )}
                          Accept
                        </Button>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {/* My proposals on other people's trades */}
          {myProposals.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display flex items-center gap-2 text-base font-semibold">
                <IconHourglass className="h-4 w-4 text-muted-foreground" />
                My Proposals
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {myProposals.map((proposal) => {
                  const tradeRarity = proposal.tradeCreatureRarity as Rarity
                  const myRarity = proposal.proposerCreatureRarity as Rarity
                  return (
                    <Card key={proposal.proposalId} className="border">
                      <CardContent>
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {proposal.tradeOwnerImage ? (
                              <img
                                src={proposal.tradeOwnerImage}
                                alt=""
                                className="h-5 w-5 rounded-full"
                              />
                            ) : null}
                            {proposal.tradeOwnerName}&apos;s trade
                          </div>
                          <Badge variant="secondary">WAITING</Badge>
                        </div>

                        <div className="mb-3 flex items-center gap-3">
                          <div className="flex-1">
                            <span
                              className={cn(
                                'font-display text-[10px] font-semibold uppercase',
                                RARITY_COLORS[myRarity],
                              )}
                            >
                              {myRarity}
                            </span>
                            <div className="font-display font-bold">
                              {proposal.proposerCreatureName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Your offer
                            </div>
                          </div>
                          <IconCardExchange className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 text-right">
                            <span
                              className={cn(
                                'font-display text-[10px] font-semibold uppercase',
                                RARITY_COLORS[tradeRarity],
                              )}
                            >
                              {tradeRarity}
                            </span>
                            <div className="font-display font-bold">
                              {proposal.tradeCreatureName}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-center text-xs text-muted-foreground">
                            Waiting for {proposal.tradeOwnerName} to decide...
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => handleWithdraw(proposal.proposalId)}
                            disabled={loading === proposal.proposalId}
                            className="w-full"
                            size="sm"
                          >
                            {loading === proposal.proposalId ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <X className="h-3.5 w-3.5" />
                            )}
                            Withdraw
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}

          {myOffersCount === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No offers yet. Browse the marketplace and make some trades!
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <CreaturePickerModal
        open={createPickerOpen}
        onOpenChange={setCreatePickerOpen}
        creatures={myCreatures}
        title="Select a Creature to Offer"
        confirmLabel="Create Trade"
        isLoading={loading === 'create'}
        onSelect={(c: PickerCreature) => {
          handleCreate(c.id)
        }}
      />

      <CreaturePickerModal
        open={!!proposePickerTradeId}
        onOpenChange={(open) => {
          if (!open) setProposePickerTradeId(null)
        }}
        creatures={myCreatures}
        title="Select a Creature to Offer"
        description="The trade owner will review your offer and can accept or decline."
        confirmLabel="Send Offer"
        onSelect={(c: PickerCreature) => {
          if (!proposePickerTradeId) return
          handlePropose(proposePickerTradeId, c.id)
          setProposePickerTradeId(null)
        }}
      />
    </div>
  )
}
