import { Loader2, X } from 'lucide-react'
import type { Rarity } from '@paleo-waifu/shared/types'
import {
  IconCardExchange,
  IconCheckMark,
  IconHourglass,
} from '@/components/icons'
import { cn } from '@/lib/utils'
import { RARITY_COLORS } from '@/lib/rarity-styles'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface IncomingProposalItem {
  proposalId: string
  tradeId: string
  proposerId: string
  proposerCreatureId: string
  createdAt: Date | null
  proposerName: string | null
  proposerImage: string | null
  proposerCreatureBaseId: string
  proposerCreatureName: string
  proposerCreatureRarity: string
  tradeCreatureBaseId: string
  tradeCreatureName: string
  tradeCreatureRarity: string
}

export interface MyProposalItem {
  proposalId: string
  tradeId: string
  proposerCreatureId: string
  createdAt: Date | null
  tradeOwnerName: string | null
  tradeOwnerImage: string | null
  tradeCreatureBaseId: string
  tradeCreatureName: string
  tradeCreatureRarity: string
  proposerCreatureBaseId: string
  proposerCreatureName: string
  proposerCreatureRarity: string
}

interface TradeMyOffersProps {
  incomingProposals: Array<IncomingProposalItem>
  myProposals: Array<MyProposalItem>
  loading: string | null
  onAccept: (proposal: {
    tradeId: string
    proposalId: string
    proposerName: string | null
    proposerCreatureName: string
  }) => void
  onWithdraw: (proposalId: string) => void
  onPreview: (creatureBaseId: string) => void
}

export function TradeMyOffers({
  incomingProposals,
  myProposals,
  loading,
  onAccept,
  onWithdraw,
  onPreview,
}: TradeMyOffersProps) {
  const myOffersCount = incomingProposals.length + myProposals.length

  return (
    <div className="space-y-6">
      {/* Incoming proposals on MY trades */}
      {incomingProposals.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-display flex items-center gap-2 text-base font-semibold">
            <IconHourglass className="h-4 w-4 text-primary" />
            Incoming Offers
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {incomingProposals.map((proposal) => {
              const proposerRarity = proposal.proposerCreatureRarity as Rarity
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
                        <button
                          className="font-display block font-bold underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:decoration-current"
                          onClick={() =>
                            onPreview(proposal.tradeCreatureBaseId)
                          }
                        >
                          {proposal.tradeCreatureName}
                        </button>
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
                        <button
                          className="font-display ml-auto block font-bold underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:decoration-current"
                          onClick={() =>
                            onPreview(proposal.proposerCreatureBaseId)
                          }
                        >
                          {proposal.proposerCreatureName}
                        </button>
                        <div className="text-xs text-muted-foreground">
                          from {proposal.proposerName}
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() =>
                        onAccept({
                          tradeId: proposal.tradeId,
                          proposalId: proposal.proposalId,
                          proposerName: proposal.proposerName,
                          proposerCreatureName: proposal.proposerCreatureName,
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
                        <button
                          className="font-display block font-bold underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:decoration-current"
                          onClick={() =>
                            onPreview(proposal.proposerCreatureBaseId)
                          }
                        >
                          {proposal.proposerCreatureName}
                        </button>
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
                        <button
                          className="font-display ml-auto block font-bold underline decoration-muted-foreground/30 underline-offset-2 transition-colors hover:decoration-current"
                          onClick={() =>
                            onPreview(proposal.tradeCreatureBaseId)
                          }
                        >
                          {proposal.tradeCreatureName}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-center text-xs text-muted-foreground">
                        Waiting for {proposal.tradeOwnerName} to decide...
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => onWithdraw(proposal.proposalId)}
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
    </div>
  )
}
