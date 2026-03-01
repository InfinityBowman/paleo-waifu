import { useState } from 'react'
import { Ban, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function BanUserDialog({
  userId,
  userName,
  isBanned,
  onSuccess,
}: {
  userId: string
  userName: string
  isBanned: boolean
  onSuccess: () => void
}) {
  const [reason, setReason] = useState('')
  const [duration, setDuration] = useState('permanent')
  const [loading, setLoading] = useState(false)

  async function handleBan() {
    setLoading(true)
    try {
      const body: Record<string, unknown> = {
        action: 'ban_user',
        userId,
        banReason: reason || undefined,
      }
      if (duration !== 'permanent') {
        body.banExpiresIn = parseInt(duration, 10)
      }
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setReason('')
        onSuccess()
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleUnban() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unban_user', userId }),
      })
      if (res.ok) {
        onSuccess()
      }
    } finally {
      setLoading(false)
    }
  }

  if (isBanned) {
    return (
      <AlertDialog>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon-xs">
                  <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                </Button>
              </AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>Unban user</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <AlertDialogContent>
          <AlertDialogTitle>Unban {userName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will restore the user&apos;s access to the platform.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnban} disabled={loading}>
              {loading ? 'Unbanning...' : 'Unban'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }

  return (
    <AlertDialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <Ban className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Ban user</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <AlertDialogContent>
        <AlertDialogTitle>Ban {userName}?</AlertDialogTitle>
        <AlertDialogDescription>
          This will prevent the user from accessing the platform.
        </AlertDialogDescription>
        <div className="space-y-3 py-2">
          <div>
            <Label htmlFor="ban-reason">Reason (optional)</Label>
            <Input
              id="ban-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for ban"
              className="mt-1"
            />
          </div>
          <div>
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="86400">1 day</SelectItem>
                <SelectItem value="604800">7 days</SelectItem>
                <SelectItem value="2592000">30 days</SelectItem>
                <SelectItem value="permanent">Permanent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBan}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? 'Banning...' : 'Ban User'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
