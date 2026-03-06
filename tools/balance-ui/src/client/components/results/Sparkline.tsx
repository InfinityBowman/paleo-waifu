export function Sparkline({
  points,
  color,
  width = 40,
  height = 14,
}: {
  points: Array<number>
  color: string
  width?: number
  height?: number
}) {
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const pad = 1

  const d = points
    .map((v, i) => {
      const x = pad + (i / (points.length - 1)) * (width - pad * 2)
      const y = pad + (1 - (v - min) / range) * (height - pad * 2)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="shrink-0">
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
