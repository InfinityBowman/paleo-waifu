import { useEffect, useState, useCallback } from 'react'
import type { OutputLine } from '../lib/types'

export function useEventSource(url: string | null) {
  const [lines, setLines] = useState<OutputLine[]>([])

  const clear = useCallback(() => setLines([]), [])

  useEffect(() => {
    if (!url) return

    const es = new EventSource(url)

    es.addEventListener('stdout', (e) => {
      const data = JSON.parse(e.data)
      setLines((prev) => [...prev, { type: 'stdout', ...data }])
    })

    es.addEventListener('stderr', (e) => {
      const data = JSON.parse(e.data)
      setLines((prev) => [...prev, { type: 'stderr', ...data }])
    })

    // Close when the stage finishes so EventSource doesn't auto-reconnect
    es.addEventListener('status', (e) => {
      const data = JSON.parse(e.data)
      if (data.status !== 'running') {
        es.close()
      }
    })

    es.onerror = () => {
      // EventSource auto-retries on error by default.
      // Only close if the server explicitly closed the connection (readyState CLOSED).
      if (es.readyState === EventSource.CLOSED) {
        es.close()
      }
    }

    return () => es.close()
  }, [url])

  return { lines, clear }
}
