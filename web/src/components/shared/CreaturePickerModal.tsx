import { useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { IconMagnifyingGlass } from '@/components/icons'
import { useMasonryColumns } from '@/hooks/useMasonryColumns'
import { CreatureCard } from '@/components/shared/CreatureCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export interface PickerCreature {
  id: string
  creatureId: string
  name: string
  scientificName?: string
  rarity: string
  era?: string
  diet?: string
  imageUrl: string | null
  imageAspectRatio?: number | null
}

interface CreaturePickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  creatures: Array<PickerCreature>
  title?: string
  description?: string
  onSelect: (creature: PickerCreature) => void
  confirmLabel?: string
  isLoading?: boolean
}

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary']

export function CreaturePickerModal({
  open,
  onOpenChange,
  creatures,
  title = 'Select a Creature',
  description,
  onSelect,
  confirmLabel = 'Confirm',
  isLoading = false,
}: CreaturePickerModalProps) {
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState('all')
  const [pending, setPending] = useState<PickerCreature | null>(null)

  const filtered = useMemo(
    () =>
      creatures.filter((c) => {
        if (search && !c.name.toLowerCase().includes(search.toLowerCase()))
          return false
        if (rarityFilter !== 'all' && c.rarity !== rarityFilter) return false
        return true
      }),
    [creatures, search, rarityFilter],
  )

  const { containerRef, columns } = useMasonryColumns(filtered)

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch('')
      setRarityFilter('all')
      setPending(null)
    }
    onOpenChange(next)
  }

  const handleConfirm = () => {
    if (!pending) return
    onSelect(pending)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="px-4 pt-4 pb-3">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {/* Filter bar */}
        <div className="flex gap-3 border-b px-4 pb-3">
          <div className="relative flex-1">
            <IconMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search creatures..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPending(null)
              }}
              className="pl-9"
            />
          </div>
          <Select
            value={rarityFilter}
            onValueChange={(v) => {
              setRarityFilter(v)
              setPending(null)
            }}
          >
            <SelectTrigger className="w-full sm:w-35">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper">
              <SelectItem value="all">All Rarities</SelectItem>
              {RARITIES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r[0].toUpperCase() + r.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Scrollable grid */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No creatures match your filters.
              </CardContent>
            </Card>
          ) : (
            <div ref={containerRef} className="flex gap-3">
              {columns.map((col, colIdx) => (
                <div key={colIdx} className="flex flex-1 flex-col gap-3">
                  {col.map((item) => (
                    <CreatureCard
                      key={item.id}
                      creature={{
                        ...item,
                        scientificName: item.scientificName ?? '',
                        era: item.era ?? '',
                      }}
                      onClick={() => setPending(item)}
                      className={
                        pending?.id === item.id
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                          : undefined
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t bg-muted/50 px-4 py-3">
          <Button onClick={handleConfirm} disabled={!pending || isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? `${confirmLabel}: ${pending.name}` : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
