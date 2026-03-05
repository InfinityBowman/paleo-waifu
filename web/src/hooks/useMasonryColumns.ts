import { useCallback, useMemo, useRef, useState } from 'react'
import { distributeToColumns } from '@/lib/utils'

export function useMasonryColumns<
  T extends { imageAspectRatio?: number | null },
>(
  items: Array<T>,
): {
  containerRef: (el: HTMLDivElement | null) => void
  columns: Array<Array<T>>
} {
  const [columnCount, setColumnCount] = useState(5)
  const observerRef = useRef<ResizeObserver | null>(null)

  const containerRef = useCallback((el: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect()
      observerRef.current = null
    }
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      setColumnCount(
        w >= 1400
          ? 7
          : w >= 1200
            ? 6
            : w >= 980
              ? 5
              : w >= 730
                ? 4
                : w >= 500
                  ? 3
                  : 2,
      )
    })
    observer.observe(el)
    observerRef.current = observer
  }, [])

  const columns = useMemo(
    () => distributeToColumns(items, columnCount),
    [items, columnCount],
  )

  return { containerRef, columns }
}
