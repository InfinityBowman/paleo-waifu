import { useEffect, useState } from 'react'
import { Input } from './input'

interface NumericInputProps
  extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  value: number
  onChange: (value: number) => void
  step?: number
  min?: number
  max?: number
  float?: boolean
}

export function NumericInput({
  value,
  onChange,
  step,
  min,
  max,
  float = false,
  ...props
}: NumericInputProps) {
  const [display, setDisplay] = useState(String(value))

  useEffect(() => {
    setDisplay(String(value))
  }, [value])

  function commit(raw: string) {
    const parsed = float ? parseFloat(raw) : parseInt(raw, 10)
    if (isNaN(parsed)) {
      setDisplay(String(value))
      return
    }
    const clamped =
      min !== undefined && max !== undefined
        ? Math.min(max, Math.max(min, parsed))
        : min !== undefined
          ? Math.max(min, parsed)
          : max !== undefined
            ? Math.min(max, parsed)
            : parsed
    onChange(clamped)
    setDisplay(String(clamped))
  }

  return (
    <Input
      {...props}
      type="number"
      step={step}
      value={display}
      onChange={(e) => setDisplay(e.target.value)}
      onBlur={() => commit(display)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit(display)
      }}
    />
  )
}
