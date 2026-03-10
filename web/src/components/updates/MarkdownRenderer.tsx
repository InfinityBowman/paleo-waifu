import { useMemo } from 'react'
import { marked } from 'marked'
import { cn } from '@/lib/utils'

export function MarkdownRenderer({
  content,
  className,
}: {
  content: string
  className?: string
}) {
  const html = useMemo(() => marked.parse(content) as string, [content])

  return (
    <div
      className={cn(
        'prose-updates text-sm leading-relaxed text-lavender/70',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
