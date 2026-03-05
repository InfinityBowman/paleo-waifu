'use client'

import * as React from 'react'
import { cva } from 'class-variance-authority'
import { Tabs as TabsPrimitive } from 'radix-ui'
import { motion } from 'motion/react'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

type TabsVariant = 'default' | 'line' | 'glass'

const TabsVariantContext = React.createContext<TabsVariant>('default')

function Tabs({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        'gap-2 group/tabs flex data-horizontal:flex-col',
        className,
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  'group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col',
  {
    variants: {
      variant: {
        default: 'rounded-lg p-[3px] group-data-horizontal/tabs:h-8 bg-muted',
        line: 'rounded-none gap-1 p-[3px] bg-transparent group-data-horizontal/tabs:h-8',
        glass:
          'relative gap-1 rounded-full border border-white/4 bg-white/3 p-1.5 backdrop-blur-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function GlassPill({ listRef }: { listRef: React.RefObject<HTMLDivElement> }) {
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

function TabsList({
  className,
  variant = 'default',
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const listRef = React.useRef<HTMLDivElement>(null!)
  const resolvedVariant = variant ?? 'default'

  return (
    <TabsVariantContext.Provider value={resolvedVariant}>
      <TabsPrimitive.List
        ref={listRef}
        data-slot="tabs-list"
        data-variant={resolvedVariant}
        className={cn(tabsListVariants({ variant }), className)}
        {...props}
      >
        {resolvedVariant === 'glass' && <GlassPill listRef={listRef} />}
        {props.children}
      </TabsPrimitive.List>
    </TabsVariantContext.Provider>
  )
}

const tabsTriggerVariants = cva(
  "text-sm font-medium relative inline-flex flex-1 items-center justify-center whitespace-nowrap transition-all gap-1.5 [&_svg:not([class*='size-'])]:size-4 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start",
  {
    variants: {
      variant: {
        default:
          'rounded-md border border-transparent px-1.5 py-0.5 h-[calc(100%-1px)] text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground data-active:bg-background data-active:text-foreground data-active:shadow-sm dark:data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30',
        line: 'rounded-md border border-transparent px-1.5 py-0.5 h-[calc(100%-1px)] text-foreground/60 hover:text-foreground dark:text-muted-foreground dark:hover:text-foreground bg-transparent data-active:bg-transparent data-active:text-foreground data-active:shadow-none dark:data-active:border-transparent dark:data-active:bg-transparent dark:data-active:text-foreground after:bg-foreground after:absolute after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 data-active:after:opacity-100',
        glass:
          'z-[1] h-auto rounded-full px-5 py-2 text-muted-foreground hover:text-foreground data-active:text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = React.useContext(TabsVariantContext)
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ variant }), className)}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('text-sm flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
