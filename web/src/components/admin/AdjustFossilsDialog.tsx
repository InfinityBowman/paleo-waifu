import { useState } from 'react'
import { Coins } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function AdjustFossilsDialog({
  userId,
  userName,
  currentFossils,
  onSuccess,
}: {
  userId: string
  userName: string
  currentFossils: number
  onSuccess: () => void
}) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const num = parseInt(amount, 10)
    if (isNaN(num) || num === 0) return

    setLoading(true)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust_fossils',
          userId,
          amount: num,
        }),
      })
      if (res.ok) {
        setOpen(false)
        setAmount('')
        onSuccess()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <Coins className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Adjust fossils</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent>
        <DialogTitle>Adjust Fossils</DialogTitle>
        <DialogDescription>
          Adjust fossil balance for {userName}. Current balance:{' '}
          {currentFossils}.
        </DialogDescription>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="amount">
              Amount (positive to add, negative to remove)
            </Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 50 or -10"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !amount}>
              {loading ? 'Adjusting...' : 'Adjust'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
