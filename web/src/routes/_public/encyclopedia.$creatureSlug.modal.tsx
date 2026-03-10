import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import type { Rarity } from '@paleo-waifu/shared/types'
import { getCreatureBySlug } from '@/routes/_public/encyclopedia'
import { CreatureDetail } from '@/components/encyclopedia/CreatureDetail'
import { cn } from '@/lib/utils'
import { RARITY_BORDER } from '@/lib/rarity-styles'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

export const Route = createFileRoute(
  '/_public/encyclopedia/$creatureSlug/modal',
)({
  loader: async ({ params }) => {
    const creature = await getCreatureBySlug({ data: params.creatureSlug })
    if (!creature) throw new Error('Creature not found')
    return creature
  },
  component: CreatureModalRoute,
  pendingComponent: CreatureModalPending,
  errorComponent: CreatureModalError,
})

function useCloseModal() {
  const navigate = useNavigate()
  const parentSearch = useSearch({ from: '/_public/encyclopedia' })
  return () => void navigate({ to: '/encyclopedia', search: parentSearch })
}

function CreatureModalRoute() {
  const closeModal = useCloseModal()
  const creature = Route.useLoaderData()
  const rarity = creature.rarity as Rarity

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeModal()
      }}
    >
      <DialogContent
        className={cn(
          'flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md',
          'border-2',
          RARITY_BORDER[rarity],
        )}
      >
        <DialogTitle className="sr-only">{creature.name}</DialogTitle>
        <CreatureDetailInModal creature={creature} />
      </DialogContent>
    </Dialog>
  )
}

function CreatureDetailInModal({
  creature,
}: {
  creature: Parameters<typeof CreatureDetail>[0]['creature']
}) {
  return (
    <div className="min-h-0 overflow-y-auto">
      <CreatureDetail creature={creature} className="border-0" />
    </div>
  )
}

function CreatureModalPending() {
  const closeModal = useCloseModal()

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeModal()
      }}
    >
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md border-2 border-border">
        <DialogTitle className="sr-only">Loading...</DialogTitle>
        <div className="space-y-4 p-6">
          <div className="h-48 animate-pulse rounded-lg bg-muted/50" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted/50" />
          <div className="h-6 w-2/3 animate-pulse rounded bg-muted/50" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-muted/50" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full animate-pulse rounded bg-muted/50" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted/50" />
            <div className="h-4 w-4/6 animate-pulse rounded bg-muted/50" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CreatureModalError() {
  const closeModal = useCloseModal()

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) closeModal()
      }}
    >
      <DialogContent className="sm:max-w-md border-2 border-border">
        <DialogTitle className="sr-only">Error</DialogTitle>
        <div className="py-8 text-center text-lavender/40">
          Creature not found.
        </div>
      </DialogContent>
    </Dialog>
  )
}
