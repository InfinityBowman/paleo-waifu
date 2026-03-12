'use client'

import * as React from 'react'
import { motion } from 'motion/react'

export function GlassPill({
  listRef,
}: {
  listRef: React.RefObject<HTMLDivElement>
}) {
  const [style, setStyle] = React.useState({ left: 0, width: 0, height: 0 })
  const [ready, setReady] = React.useState(false)

  React.useEffect(() => {
    const list = listRef.current

    const update = () => {
      const active = list.querySelector<HTMLElement>('[data-state="active"]')
      if (active) {
        setStyle({
          left: active.offsetLeft,
          width: active.offsetWidth,
          height: active.offsetHeight,
        })
        setReady(true)
      }
    }

    update()
    const observer = new MutationObserver(update)
    observer.observe(list, {
      attributes: true,
      subtree: true,
      attributeFilter: ['data-state'],
    })
    return () => observer.disconnect()
  }, [listRef])

  if (!ready) return null

  return (
    <motion.div
      className="pointer-events-none absolute rounded-full border border-input bg-white/8 dark:bg-input/30"
      animate={{
        left: style.left,
        width: style.width,
        height: style.height,
      }}
      transition={{ type: 'spring', stiffness: 450, damping: 32 }}
    />
  )
}
