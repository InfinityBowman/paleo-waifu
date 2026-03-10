import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'
import type { PickerCreature } from '@/components/shared/CreaturePickerModal'
import { CreatureModal } from '@/components/collection/CreatureModal'
import { getCreaturePreview } from '@/routes/_app/trade'
import { Button } from '@/components/ui/button'
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
import { TradeMarketplace } from './TradeMarketplace'
import { TradeMyOffers } from './TradeMyOffers'
import type { TradeItem } from './TradeMarketplace'
import type { IncomingProposalItem, MyProposalItem } from './TradeMyOffers'

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
  hasMore,
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

  // Creature preview modal
  const [previewCreature, setPreviewCreature] = useState<Awaited<
    ReturnType<typeof getCreaturePreview>
  > | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)

  const openCreaturePreview = async (creatureBaseId: string) => {
    setPreviewOpen(true)
    const data = await getCreaturePreview({ data: creatureBaseId })
    setPreviewCreature(data)
  }

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

  // Group incoming proposals by tradeId for count display
  const incomingCountByTrade = new Map<string, number>()
  for (const p of incomingProposals) {
    incomingCountByTrade.set(
      p.tradeId,
      (incomingCountByTrade.get(p.tradeId) ?? 0) + 1,
    )
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
          <TradeMarketplace
            trades={trades}
            userId={userId}
            loading={loading}
            hasMore={hasMore}
            incomingCountByTrade={incomingCountByTrade}
            onCancel={handleCancel}
            onPropose={(tradeId) => setProposePickerTradeId(tradeId)}
            onPreview={openCreaturePreview}
          />
        </TabsContent>

        <TabsContent value="my-offers" className="space-y-6">
          <TradeMyOffers
            incomingProposals={incomingProposals}
            myProposals={myProposals}
            loading={loading}
            onAccept={setConfirmProposal}
            onWithdraw={handleWithdraw}
            onPreview={openCreaturePreview}
          />
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

      <CreatureModal
        creature={previewCreature}
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open)
          if (!open) setPreviewCreature(null)
        }}
      />
    </div>
  )
}
