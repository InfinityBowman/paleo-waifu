import {
  Circle,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import type { StageStatus } from '../lib/types'

const config: Record<
  StageStatus,
  { icon: typeof Circle; color: string; label: string; animate?: string }
> = {
  idle: {
    icon: Circle,
    color: 'text-status-idle',
    label: 'Idle',
  },
  running: {
    icon: Loader2,
    color: 'text-status-running',
    label: 'Running',
    animate: 'animate-spin',
  },
  success: {
    icon: CheckCircle2,
    color: 'text-status-success',
    label: 'Done',
  },
  failed: {
    icon: XCircle,
    color: 'text-status-failed',
    label: 'Failed',
  },
}

export function StatusBadge({
  status,
  showLabel = true,
  size = 16,
}: {
  status: StageStatus
  showLabel?: boolean
  size?: number
}) {
  const { icon: Icon, color, label, animate } = config[status]

  return (
    <span className={`inline-flex items-center gap-1.5 ${color}`}>
      <Icon size={size} className={animate} />
      {showLabel && (
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      )}
    </span>
  )
}
