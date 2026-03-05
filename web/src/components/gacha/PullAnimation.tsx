import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronRight, X } from 'lucide-react'
import type { PullResult } from '@/lib/gacha'
import type { Rarity } from '@paleo-waifu/shared/types'
import { RARITY_ORDER } from '@paleo-waifu/shared/types'
import { IconMining } from '@/components/icons'
import { distributeToColumns } from '@/lib/utils'
import { CreatureCard } from '@/components/shared/CreatureCard'
import { CreatureModal } from '@/components/collection/CreatureModal'
import { useAppStore } from '@/store/appStore'

type RevealPhase = 'idle' | 'revealing' | 'browsing' | 'closing'

/* ═══ Rarity color config ═══ */

const RARITY_CSS_VAR: Record<Rarity, string> = {
  common: '--color-rarity-common',
  uncommon: '--color-rarity-uncommon',
  rare: '--color-rarity-rare',
  epic: '--color-rarity-epic',
  legendary: '--color-rarity-legendary',
}

const RARITY_GLOW_OPACITY: Record<Rarity, number> = {
  common: 0.3,
  uncommon: 0.4,
  rare: 0.5,
  epic: 0.6,
  legendary: 0.8,
}

/** Delay (ms) before the next card begins its reveal, based on rarity of CURRENT card */
const RARITY_REVEAL_DELAY: Record<Rarity, number> = {
  common: 200,
  uncommon: 200,
  rare: 350,
  epic: 500,
  legendary: 900,
}

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 400, damping: 30 }

/* ═══ Dust particles for excavation ═══ */

function DustParticle({
  delay,
  left,
  size,
}: {
  delay: string
  left: number
  size?: number
}) {
  return (
    <div
      className="absolute bottom-8 text-muted-foreground/50"
      style={{
        animation: 'particle-rise 1.5s ease-out infinite',
        animationDelay: delay,
        left: `${left}%`,
        fontSize: size ?? 12,
      }}
    >
      .
    </div>
  )
}

/* ═══ Crack SVG overlay for excavation ═══ */

function CrackOverlay() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 400 200"
      fill="none"
      preserveAspectRatio="xMidYMid slice"
    >
      {/* Central crack lines radiating outward */}
      <path
        d="M200 100 L160 60 L140 65 L110 30"
        stroke="oklch(0.8 0.08 340 / 0.25)"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="animate-crack-spread"
        style={{ animationDelay: '0.3s' }}
      />
      <path
        d="M200 100 L240 55 L270 50 L290 25"
        stroke="oklch(0.8 0.08 340 / 0.2)"
        strokeWidth="1"
        strokeLinecap="round"
        className="animate-crack-spread"
        style={{ animationDelay: '0.6s' }}
      />
      <path
        d="M200 100 L230 130 L260 140 L300 155"
        stroke="oklch(0.8 0.08 340 / 0.15)"
        strokeWidth="1"
        strokeLinecap="round"
        className="animate-crack-spread"
        style={{ animationDelay: '0.9s' }}
      />
      <path
        d="M200 100 L170 135 L145 150 L110 170"
        stroke="oklch(0.8 0.08 340 / 0.2)"
        strokeWidth="1.5"
        strokeLinecap="round"
        className="animate-crack-spread"
        style={{ animationDelay: '1.2s' }}
      />
      <path
        d="M200 100 L195 70 L185 40"
        stroke="oklch(0.8 0.08 340 / 0.12)"
        strokeWidth="0.8"
        strokeLinecap="round"
        className="animate-crack-spread"
        style={{ animationDelay: '1.5s' }}
      />
    </svg>
  )
}

/* ═══ Phase 1: Enhanced Excavation ═══ */

function ExcavationView() {
  const dustPositions = useMemo(
    () => [20, 30, 40, 50, 60, 70, 80].map((base) => base + ((base * 7) % 10)),
    [],
  )

  return (
    <div className="animate-excavate-shake relative flex items-center justify-center p-16">
      {/* Pulsing radial glow that intensifies */}
      <div
        className="animate-glow-intensify pointer-events-none absolute -inset-32"
        style={{
          background:
            'radial-gradient(ellipse at center, oklch(0.65 0.15 340 / 0.15) 0%, transparent 40%)',
        }}
      />

      {/* Ambient light seeping through */}
      <div
        className="pointer-events-none absolute -inset-32"
        style={{
          background:
            'radial-gradient(ellipse at center, oklch(0.85 0.12 55 / 0.04) 0%, transparent 35%)',
          animation: 'glow-intensify 3s ease-in-out forwards',
          animationDelay: '1s',
        }}
      />

      {/* Crack overlay */}
      <CrackOverlay />

      {/* Base gradient */}
      <div className="pointer-events-none absolute -inset-32 bg-[radial-gradient(ellipse_at_center,oklch(0.55_0.18_340/0.06)_0%,transparent_45%)]" />

      <div className="relative flex flex-col items-center gap-4">
        <div className="animate-dig text-4xl">
          <IconMining className="h-12 w-12 text-primary" />
        </div>
        <p className="font-display text-lg text-muted-foreground">
          Excavating
          <span className="inline-flex w-6">
            <span className="animate-bounce" style={{ animationDelay: '0ms' }}>
              .
            </span>
            <span
              className="animate-bounce"
              style={{ animationDelay: '150ms' }}
            >
              .
            </span>
            <span
              className="animate-bounce"
              style={{ animationDelay: '300ms' }}
            >
              .
            </span>
          </span>
        </p>

        {/* Enhanced dust particles */}
        {dustPositions.map((pos, i) => (
          <DustParticle
            key={i}
            delay={`${i * 0.2}s`}
            left={pos}
            size={i % 2 === 0 ? 14 : 10}
          />
        ))}
      </div>
    </div>
  )
}

/* ═══ Burst Particles ═══ */

function BurstParticles({ color }: { color: string }) {
  const particles = useMemo(() => {
    const count = 8
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2
      const distance = 60 + ((i * 17 + 5) % 40)
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size: 4 + ((i * 3 + 1) % 5),
        delay: ((i * 7) % 10) / 100,
      }
    })
  }, [])

  return (
    <>
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 rounded-full"
          style={
            {
              width: p.size,
              height: p.size,
              background: color,
              '--burst-x': `${p.x}px`,
              '--burst-y': `${p.y}px`,
              animation: `particle-burst 0.6s ease-out ${p.delay}s forwards`,
              marginLeft: -p.size / 2,
              marginTop: -p.size / 2,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  )
}

/* ═══ Light Rays (legendary only) ═══ */

function LightRays({ color }: { color: string }) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{
        width: 300,
        height: 300,
        animation: 'light-rays 8s linear infinite',
      }}
    >
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 origin-center"
          style={{
            width: 2,
            height: 120,
            background: `linear-gradient(to bottom, ${color}, transparent)`,
            transform: `translate(-50%, -100%) rotate(${i * 45}deg)`,
            opacity: 0.3,
          }}
        />
      ))}
    </div>
  )
}

/* ═══ Phase 2a: Single Pull Reveal ═══ */

function SingleReveal({
  result,
  onComplete,
  onSkip,
}: {
  result: PullResult
  onComplete: () => void
  onSkip: () => void
}) {
  const [stage, setStage] = useState<
    'orb' | 'burst' | 'card' | 'settled' | 'done'
  >('orb')
  const rarity = result.rarity
  const cssVar = RARITY_CSS_VAR[rarity]
  const glowOpacity = RARITY_GLOW_OPACITY[rarity]
  const color = `color-mix(in oklch, var(${cssVar}) ${Math.round(glowOpacity * 100)}%, transparent)`
  const isLegendary = rarity === 'legendary'
  const isEpic = rarity === 'epic'

  const singleDots = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        size: 2 + ((i * 7 + 3) % 4),
        top: 10 + ((i * 37 + 13) % 80),
        left: 10 + ((i * 53 + 7) % 80),
        opacity: 0.05 + ((i * 11 + 5) % 8) / 100,
        duration: 3 + ((i * 13 + 2) % 4),
        delay: (i * 17 + 3) % 3,
      })),
    [],
  )

  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = []

    // 600ms: burst fires as orb starts collapsing
    timers.push(setTimeout(() => setStage('burst'), 600))
    // 400ms burst
    timers.push(setTimeout(() => setStage('card'), 1000))
    // Card settled
    timers.push(setTimeout(() => setStage('settled'), 1800))
    // Auto-complete
    timers.push(setTimeout(() => onComplete(), 3000))

    return () => timers.forEach(clearTimeout)
  }, [onComplete])

  const showOrb = stage === 'orb' || stage === 'burst'
  const showBurst = stage === 'burst'
  const showCard = stage === 'card' || stage === 'settled' || stage === 'done'

  return (
    <div
      className="relative flex min-h-75 cursor-pointer items-center justify-center"
      onClick={() => {
        if (stage !== 'orb') onSkip()
      }}
    >
      {/* Skip button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onSkip()
        }}
        className="absolute right-3 top-3 z-30 flex items-center gap-1 rounded-full bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground/60 backdrop-blur-sm transition-colors hover:bg-muted/50 hover:text-muted-foreground"
      >
        Skip <ChevronRight className="h-3 w-3" />
      </button>

      {/* Ambient floating dots */}
      {singleDots.map((d, i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-full"
          style={{
            width: d.size,
            height: d.size,
            top: `${d.top}%`,
            left: `${d.left}%`,
            background: `oklch(1 0 0 / ${d.opacity})`,
            animation: `float ${d.duration}s ease-in-out infinite ${d.delay}s`,
          }}
        />
      ))}

      {/* Legendary light rays */}
      {isLegendary && showOrb && <LightRays color={color} />}

      {/* Orb — single continuous scale: 0 → peak → 0 with no pause */}
      {showOrb && (
        <motion.div
          className="relative z-10"
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 1, 0], scale: [0, 1.1, 1.05, 0] }}
          transition={{
            duration: 0.8,
            times: [0, 0.35, 0.75, 1],
            ease: 'easeInOut',
          }}
        >
          <div className="grid place-items-center *:[grid-area:1/1]">
            <div
              className="rounded-full"
              style={{
                width: isLegendary ? 80 : isEpic ? 70 : 60,
                height: isLegendary ? 80 : isEpic ? 70 : 60,
                background: `radial-gradient(circle, color-mix(in oklch, var(${cssVar}) 80%, white) 0%, color-mix(in oklch, var(${cssVar}) 50%, transparent) 60%, transparent 100%)`,
                boxShadow: `0 0 40px ${color}, 0 0 80px ${color}`,
              }}
            />
            {/* Epic/Legendary pulsing rings */}
            {(isEpic || isLegendary) && (
              <div
                className="rounded-full border"
                style={{
                  width: 100,
                  height: 100,
                  borderColor: color,
                  animation: 'glow-pulse 1.5s ease-in-out infinite',
                  opacity: 0.4,
                }}
              />
            )}
            {isLegendary && (
              <div
                className="rounded-full border"
                style={{
                  width: 130,
                  height: 130,
                  borderColor: color,
                  animation: 'glow-pulse 1.5s ease-in-out infinite 0.5s',
                  opacity: 0.25,
                }}
              />
            )}
          </div>
        </motion.div>
      )}

      {/* Burst effects */}
      <AnimatePresence>
        {showBurst && (
          <motion.div
            key="burst"
            className="pointer-events-none absolute -inset-32 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Flash */}
            <div
              className="animate-reveal-flash absolute inset-0"
              style={{
                background: `radial-gradient(circle at center, ${color} 0%, transparent 45%)`,
              }}
            />
            {/* Expanding ring */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div
                className="animate-ring-expand rounded-full border-2"
                style={{
                  width: 60,
                  height: 60,
                  borderColor: color,
                }}
              />
            </div>
            {/* Particle burst */}
            <BurstParticles color={color} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card materializing */}
      <AnimatePresence>
        {showCard && (
          <motion.div
            key="card"
            className="relative z-20 mx-auto max-w-50"
            initial={{ opacity: 0, y: 40, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <CreatureCard
              creature={result}
              eager
              style={
                isLegendary
                  ? {
                      boxShadow: `0 0 30px ${color}, 0 0 60px color-mix(in oklch, var(${cssVar}) 20%, transparent)`,
                    }
                  : undefined
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ═══ Phase 2b: Multi Pull Reveal ═══ */

function MultiReveal({
  results,
  onComplete,
  onSkip,
}: {
  results: Array<PullResult>
  onComplete: () => void
  onSkip: () => void
}) {
  const [revealedCount, setRevealedCount] = useState(0)
  const [currentDrama, setCurrentDrama] = useState<Rarity | null>(null)
  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([])
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [gridCols, setGridCols] = useState(5)

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width
      setGridCols(w < 500 ? 3 : 5)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Sort by rarity ascending so best cards reveal last
  const sortedResults = useMemo(() => {
    return [...results].sort(
      (a, b) => RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity],
    )
  }, [results])

  useEffect(() => {
    let elapsed = 200 // initial delay

    for (let i = 0; i < sortedResults.length; i++) {
      const rarity = sortedResults[i].rarity
      const revealTime = elapsed

      // Show drama effect slightly before card for epic/legendary
      if (rarity === 'epic' || rarity === 'legendary') {
        timeoutsRef.current.push(
          setTimeout(() => setCurrentDrama(rarity), revealTime - 100),
        )
      }

      timeoutsRef.current.push(
        setTimeout(() => {
          setRevealedCount(i + 1)
          // Clear drama after a moment
          if (rarity === 'epic' || rarity === 'legendary') {
            setTimeout(() => setCurrentDrama(null), 400)
          }
        }, revealTime),
      )

      elapsed += RARITY_REVEAL_DELAY[rarity]
    }

    // Auto-complete after all revealed
    timeoutsRef.current.push(setTimeout(() => onComplete(), elapsed + 500))

    return () => timeoutsRef.current.forEach(clearTimeout)
  }, [sortedResults, onComplete])

  const cardCount = sortedResults.length
  const useDoubleRow = cardCount > 5

  const multiDots = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        size: 2 + ((i * 5 + 1) % 3),
        top: 10 + ((i * 41 + 17) % 80),
        left: 10 + ((i * 59 + 11) % 80),
        opacity: 0.04 + ((i * 13 + 3) % 6) / 100,
        duration: 3 + ((i * 11 + 1) % 4),
        delay: (i * 19 + 5) % 3,
      })),
    [],
  )

  return (
    <div className="relative pt-10">
      {/* Skip button */}
      <button
        onClick={onSkip}
        className="absolute right-0 top-0 z-30 flex items-center gap-1 rounded-full bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground/60 backdrop-blur-sm transition-colors hover:bg-muted/50 hover:text-muted-foreground"
      >
        Skip <ChevronRight className="h-3 w-3" />
      </button>

      {/* Ambient floating dots */}
      {multiDots.map((d, i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-full"
          style={{
            width: d.size,
            height: d.size,
            top: `${d.top}%`,
            left: `${d.left}%`,
            background: `oklch(1 0 0 / ${d.opacity})`,
            animation: `float ${d.duration}s ease-in-out infinite ${d.delay}s`,
          }}
        />
      ))}

      {/* Drama flash for epic/legendary */}
      <AnimatePresence>
        {currentDrama && (
          <motion.div
            key={currentDrama}
            className="pointer-events-none absolute -inset-32 z-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              background: `radial-gradient(circle at center, color-mix(in oklch, var(${RARITY_CSS_VAR[currentDrama]}) ${currentDrama === 'legendary' ? 30 : 20}%, transparent) 0%, transparent 45%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Card grid */}
      <div
        ref={gridRef}
        className="relative z-20 grid gap-3"
        style={{
          gridTemplateColumns: useDoubleRow
            ? `repeat(${gridCols}, minmax(0, 1fr))`
            : `repeat(${Math.min(cardCount, 5)}, minmax(0, 1fr))`,
        }}
      >
        {sortedResults.map((result, i) => {
          const isRevealed = i < revealedCount
          const rarity = result.rarity
          const cssVar = RARITY_CSS_VAR[rarity]
          const isHighRarity = rarity === 'epic' || rarity === 'legendary'

          return (
            <div key={result.userCreatureId} className="relative">
              {!isRevealed ? (
                /* Glow dot placeholder */
                <div className="flex aspect-3/4 items-center justify-center rounded-xl border border-dashed border-muted/30 bg-muted/5">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{
                      background: 'oklch(1 0 0 / 0.08)',
                      animation: 'glow-dot-appear 0.3s ease-out forwards',
                    }}
                  />
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    duration: 0.5,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  style={
                    isHighRarity
                      ? {
                          boxShadow: `0 0 20px color-mix(in oklch, var(${cssVar}) 25%, transparent)`,
                        }
                      : undefined
                  }
                >
                  <CreatureCard creature={result} eager />
                </motion.div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══ Phase 3: Masonry Browse ═══ */

function MasonryBrowse({
  results,
  onSelect,
  onClose,
}: {
  results: Array<PullResult>
  onSelect: (result: PullResult) => void
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [columnCount, setColumnCount] = useState(5)

  useEffect(() => {
    const el = containerRef.current
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
    return () => observer.disconnect()
  }, [])

  const columns = useMemo(
    () => distributeToColumns(results, columnCount),
    [results, columnCount],
  )

  return (
    <div className="relative pt-10">
      <button
        onClick={onClose}
        className="absolute right-0 top-0 z-10 rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div ref={containerRef} className="flex gap-4">
        {columns.map((col, colIdx) => (
          <div key={colIdx} className="flex flex-1 flex-col gap-4">
            {col.map((r) => (
              <motion.div
                key={r.userCreatureId}
                initial={{ opacity: 0, scale: 0.6, rotateY: 90 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              >
                <CreatureCard creature={r} eager onClick={() => onSelect(r)} />
              </motion.div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ═══ Main PullAnimation Component ═══ */

export function PullAnimation() {
  const { pullResults, isPulling, clearPullResults } = useAppStore()
  const [phase, setPhase] = useState<RevealPhase>('idle')
  const [selected, setSelected] = useState<PullResult | null>(null)
  const prevIsPullingRef = useRef(isPulling)

  // When isPulling goes from true → false and results exist, start reveal
  useEffect(() => {
    if (prevIsPullingRef.current && !isPulling && pullResults.length > 0) {
      setPhase('revealing')
    }
    prevIsPullingRef.current = isPulling
  }, [isPulling, pullResults.length])

  // Reset phase when results are cleared (but not during closing animation)
  useEffect(() => {
    if (pullResults.length === 0 && phase !== 'closing') {
      setPhase('idle')
    }
  }, [pullResults.length, phase])

  // Preload images as soon as results arrive (during excavation)
  useEffect(() => {
    if (pullResults.length === 0) return
    pullResults.forEach((r) => {
      if (r.imageUrl) {
        const img = new Image()
        img.src = r.imageUrl
      }
    })
  }, [pullResults])

  const handleRevealComplete = useCallback(() => {
    setPhase('browsing')
  }, [])

  const handleSkip = useCallback(() => {
    setPhase('browsing')
  }, [])

  const handleClose = useCallback(() => {
    setPhase('closing')
  }, [])

  const isSingle = pullResults.length === 1

  // Determine which phase key to render
  // 'closing' still renders 'browse' so AnimatePresence can play its exit
  let phaseKey = 'idle'
  if (isPulling) phaseKey = 'excavation'
  else if (pullResults.length > 0 && phase === 'revealing') phaseKey = 'reveal'
  else if (pullResults.length > 0 && phase === 'browsing') phaseKey = 'browse'
  else if (pullResults.length > 0 && phase === 'closing') phaseKey = 'closing'

  return (
    <>
      <AnimatePresence
        mode="wait"
        onExitComplete={() => {
          if (phase === 'closing') {
            clearPullResults()
            setPhase('idle')
          }
        }}
      >
        {phaseKey === 'excavation' && (
          <motion.div
            key="excavation"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25 }}
          >
            <ExcavationView />
          </motion.div>
        )}

        {phaseKey === 'reveal' && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {isSingle ? (
              <SingleReveal
                result={pullResults[0]}
                onComplete={handleRevealComplete}
                onSkip={handleSkip}
              />
            ) : (
              <MultiReveal
                results={pullResults}
                onComplete={handleRevealComplete}
                onSkip={handleSkip}
              />
            )}
          </motion.div>
        )}

        {(phaseKey === 'browse' || phaseKey === 'closing') && (
          <motion.div
            key="browse"
            initial={{ opacity: 0, y: 10 }}
            animate={
              phaseKey === 'closing'
                ? { opacity: 0, y: 20, scale: 0.97 }
                : { opacity: 1, y: 0 }
            }
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={SPRING_SNAPPY}
          >
            <MasonryBrowse
              results={pullResults}
              onSelect={setSelected}
              onClose={handleClose}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <CreatureModal
        creature={selected}
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
      />
    </>
  )
}
