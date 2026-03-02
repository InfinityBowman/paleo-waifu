import { useEffect, useRef, useState, useMemo } from 'react'
import { ArrowDownToLine, Trash2 } from 'lucide-react'
import type { OutputLine } from '../lib/types'
import AnsiToHtml from 'ansi-to-html'

const ansiConverter = new AnsiToHtml({
  fg: '#d4d4d8',
  bg: 'transparent',
  colors: {
    0: '#71717a',
    1: '#ef4444',
    2: '#22c55e',
    3: '#eab308',
    4: '#3b82f6',
    5: '#a855f7',
    6: '#06b6d4',
    7: '#d4d4d8',
  },
})

export function OutputTerminal({
  lines,
  onClear,
}: {
  lines: OutputLine[]
  onClear?: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  // Auto-scroll when new lines arrive
  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [lines.length, autoScroll])

  // Detect manual scroll
  const handleScroll = () => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 40
    setAutoScroll(atBottom)
  }

  // Process lines: collapse \r sequences (tqdm progress)
  const processedLines = useMemo(() => {
    const result: OutputLine[] = []
    for (const line of lines) {
      // If the line looks like a tqdm update (contains %) and previous line also was,
      // replace the previous line
      if (
        result.length > 0 &&
        line.line.includes('%|') &&
        result[result.length - 1].line.includes('%|')
      ) {
        result[result.length - 1] = line
      } else {
        result.push(line)
      }
    }
    return result
  }, [lines])

  return (
    <div className="flex flex-col rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-terminal-bg/50 px-3 py-1.5">
        <span className="text-xs text-muted-foreground font-mono">
          Output{' '}
          <span className="text-muted-foreground/50">
            ({processedLines.length} lines)
          </span>
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setAutoScroll(true)
              if (containerRef.current) {
                containerRef.current.scrollTop =
                  containerRef.current.scrollHeight
              }
            }}
            className={`rounded p-1 transition-colors ${
              autoScroll
                ? 'text-status-running'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title="Auto-scroll"
          >
            <ArrowDownToLine size={13} />
          </button>
          {onClear && (
            <button
              onClick={onClear}
              className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Clear"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Terminal body */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-80 overflow-y-auto overflow-x-hidden bg-terminal-bg p-3 font-mono text-xs leading-5"
      >
        {processedLines.length === 0 ? (
          <span className="text-muted-foreground/40 italic">
            No output yet...
          </span>
        ) : (
          processedLines.map((line, i) => (
            <div
              key={i}
              className={`terminal-output whitespace-pre-wrap break-all ${
                line.type === 'stderr'
                  ? 'text-terminal-stderr'
                  : 'text-terminal-text'
              }`}
              dangerouslySetInnerHTML={{
                __html: ansiConverter.toHtml(line.line),
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
