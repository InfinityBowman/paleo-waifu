import { useCallback, useState } from 'react'
import { Check, ClipboardCopy } from 'lucide-react'
import { Button } from '../ui/button'
import { buildFieldTextSummary } from './buildFieldTextSummary'
import type { FieldResult } from '../../../shared/types.ts'

interface Props {
  result: FieldResult
}

export function FieldCopyButton({ result }: Props) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    const text = buildFieldTextSummary(result)
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        // clipboard may be denied — silently ignore
      })
  }, [result])

  return (
    <Button variant="outline" size="xs" onClick={handleCopy}>
      {copied ? (
        <>
          <Check size={12} />
          Copied
        </>
      ) : (
        <>
          <ClipboardCopy size={12} />
          Copy Summary
        </>
      )}
    </Button>
  )
}
