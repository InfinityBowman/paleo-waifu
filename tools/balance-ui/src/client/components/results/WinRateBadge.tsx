import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

export function WinRateBadge({ wr }: { wr: number }) {
  const pct = (wr * 100).toFixed(1)
  if (wr > 0.55)
    return (
      <span className="text-success">
        {pct}% <ArrowUp size={10} className="inline" />
      </span>
    )
  if (wr < 0.45)
    return (
      <span className="text-destructive">
        {pct}% <ArrowDown size={10} className="inline" />
      </span>
    )
  return (
    <span className="text-muted-foreground">
      {pct}% <Minus size={10} className="inline" />
    </span>
  )
}
