import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Swords } from 'lucide-react'

/* ═══ Types ═══ */

export interface BattleOutcome {
  battleId: string
  won: boolean | null // null = draw
  ratingDelta?: number | null
  mode: 'arena' | 'friendly'
}

export interface BattlePlayers {
  attackerName: string
  attackerImage: string | null
  defenderName: string
  defenderImage: string | null
}

type Phase = 'charging' | 'clash' | 'result'

interface BattleTransitionProps {
  active: boolean
  players: BattlePlayers | null
  outcome: BattleOutcome | null
  onNavigate: (battleId: string) => void
}

/* ═══ Constants ═══ */

const RESULT_CONFIG = {
  victory: {
    text: 'VICTORY',
    color: 'oklch(0.75 0.2 145)',
    glow: 'oklch(0.75 0.2 145 / 0.4)',
    accent: 'oklch(0.85 0.15 145)',
  },
  defeat: {
    text: 'DEFEAT',
    color: 'oklch(0.65 0.25 25)',
    glow: 'oklch(0.65 0.25 25 / 0.4)',
    accent: 'oklch(0.75 0.2 25)',
  },
  draw: {
    text: 'DRAW',
    color: 'oklch(0.7 0.06 280)',
    glow: 'oklch(0.7 0.06 280 / 0.3)',
    accent: 'oklch(0.8 0.04 280)',
  },
} as const

/* ═══ Speed lines — the classic shounen radial burst ═══ */

function SpeedLines({ intensity }: { intensity: 'low' | 'high' }) {
  const lines = useMemo(() => {
    const count = intensity === 'high' ? 40 : 24
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * 360
      const length = 80 + ((i * 37 + 13) % 60)
      const width =
        intensity === 'high' ? 1.5 + ((i * 7) % 2) : 0.8 + ((i * 3) % 1.5)
      const opacity =
        intensity === 'high'
          ? 0.15 + ((i * 11) % 15) / 100
          : 0.06 + ((i * 7) % 8) / 100
      const delay = ((i * 13) % 20) / 100
      return { angle, length, width, opacity, delay }
    })
  }, [intensity])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2 h-0 w-0"
        style={{
          animation:
            intensity === 'high'
              ? 'battle-speed-rotate 4s linear infinite'
              : 'battle-speed-rotate 8s linear infinite',
        }}
      >
        {lines.map((l, i) => (
          <div
            key={i}
            className="absolute origin-left"
            style={{
              width: `${l.length}vh`,
              height: l.width,
              background: `linear-gradient(90deg, transparent 0%, oklch(1 0 0 / ${l.opacity}) 30%, oklch(1 0 0 / ${l.opacity * 0.3}) 100%)`,
              transform: `rotate(${l.angle}deg)`,
              animation: `battle-line-pulse 1.5s ease-in-out infinite ${l.delay}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

/* ═══ Impact spark particles ═══ */

function ImpactSparks({ color }: { color: string }) {
  const sparks = useMemo(() => {
    return Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2 + ((i * 0.3) % 0.5)
      const distance = 100 + ((i * 41 + 7) % 120)
      const size = 3 + ((i * 7 + 2) % 5)
      const delay = ((i * 11) % 15) / 100
      return {
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        size,
        delay,
        trail: i % 3 === 0,
      }
    })
  }, [])

  return (
    <>
      {sparks.map((s, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2"
          style={
            {
              width: s.size,
              height: s.trail ? s.size * 3 : s.size,
              borderRadius: s.trail ? s.size : '50%',
              background: color,
              '--burst-x': `${s.x}px`,
              '--burst-y': `${s.y}px`,
              animation: `particle-burst 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${s.delay}s forwards`,
              marginLeft: -s.size / 2,
              marginTop: -s.size / 2,
              boxShadow: `0 0 ${s.size * 2}px ${color}`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  )
}

/* ═══ Slash marks — diagonal impact lines ═══ */

function SlashMarks() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <line
        x1="20"
        y1="0"
        x2="80"
        y2="100"
        stroke="oklch(1 0 0 / 0.15)"
        strokeWidth="0.3"
        strokeLinecap="round"
        style={{
          strokeDasharray: 200,
          strokeDashoffset: 200,
          animation: 'battle-slash 0.3s ease-out 0.05s forwards',
        }}
      />
      <line
        x1="80"
        y1="0"
        x2="20"
        y2="100"
        stroke="oklch(1 0 0 / 0.12)"
        strokeWidth="0.25"
        strokeLinecap="round"
        style={{
          strokeDasharray: 200,
          strokeDashoffset: 200,
          animation: 'battle-slash 0.3s ease-out 0.15s forwards',
        }}
      />
      <line
        x1="50"
        y1="0"
        x2="50"
        y2="100"
        stroke="oklch(0.65 0.15 340 / 0.08)"
        strokeWidth="0.15"
        strokeLinecap="round"
        style={{
          strokeDasharray: 200,
          strokeDashoffset: 200,
          animation: 'battle-slash 0.3s ease-out 0.25s forwards',
        }}
      />
    </svg>
  )
}

/* ═══ Energy ring — pulsing concentric circles ═══ */

function EnergyRing({
  delay,
  size,
  color,
}: {
  delay: number
  size: number
  color: string
}) {
  return (
    <div
      className="absolute left-1/2 top-1/2 rounded-full border"
      style={{
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        borderColor: color,
        animation: `battle-ring-pulse 2s ease-out infinite ${delay}s`,
      }}
    />
  )
}

/* ═══ Lightning bolt SVG divider ═══ */

function LightningBolt() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        animation: 'battle-bolt-flicker 2s ease-in-out infinite',
      }}
    >
      <polyline
        points="54,0 48,28 55,30 44,52 53,54 38,78 52,80 42,100"
        fill="none"
        stroke="oklch(0.92 0.08 230)"
        strokeWidth="0.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Thicker glow layer */}
      <polyline
        points="54,0 48,28 55,30 44,52 53,54 38,78 52,80 42,100"
        fill="none"
        stroke="oklch(0.85 0.12 230 / 0.4)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* ═══ Fighting-game name plate ═══ */

function NamePlate({
  name,
  image,
  side,
  delay,
}: {
  name: string
  image: string | null
  side: 'attacker' | 'defender'
  delay: number
}) {
  const isAttacker = side === 'attacker'
  const color = isAttacker ? 'oklch(0.65 0.15 340)' : 'oklch(0.55 0.2 250)'
  const strokeColor = isAttacker
    ? 'oklch(0.35 0.12 340)'
    : 'oklch(0.25 0.15 250)'
  const glowColor = isAttacker
    ? 'oklch(0.65 0.15 340 / 0.6)'
    : 'oklch(0.55 0.2 250 / 0.6)'

  return (
    <motion.div
      className="absolute flex items-center gap-3 sm:gap-5"
      style={{
        ...(isAttacker
          ? { top: '18%', left: '5%' }
          : { bottom: '18%', right: '5%' }),
      }}
      initial={{
        opacity: 0,
        x: isAttacker ? -200 : 200,
        rotate: isAttacker ? -3 : 3,
      }}
      animate={{
        opacity: 1,
        x: 0,
        rotate: isAttacker ? -2 : 2,
      }}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {/* Avatar */}
      {isAttacker && (
        <motion.div
          className="shrink-0 overflow-hidden rounded-full"
          style={{
            width: 56,
            height: 56,
            border: `3px solid ${color}`,
            boxShadow: `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`,
          }}
          animate={{
            boxShadow: [
              `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`,
              `0 0 30px ${glowColor}, 0 0 60px ${glowColor}`,
              `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`,
            ],
          }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {image ? (
            <img
              src={image}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-xl font-bold"
              style={{
                fontFamily: "'Bangers', cursive",
                background: 'oklch(0.12 0.03 290)',
                color: 'oklch(0.7 0.04 290)',
              }}
            >
              {(name[0] || '?').toUpperCase()}
            </div>
          )}
        </motion.div>
      )}

      {/* Name text — HUGE with thick outline */}
      <div
        className="relative"
        style={{
          animation: 'battle-name-pulse 3s ease-in-out infinite',
        }}
      >
        {/* Outline/stroke layer */}
        <span
          className="pointer-events-none absolute inset-0 select-none text-4xl tracking-wider sm:text-6xl md:text-7xl"
          style={{
            fontFamily: "'Bangers', cursive",
            color: 'transparent',
            WebkitTextStroke: `4px ${strokeColor}`,
            paintOrder: 'stroke fill',
          }}
          aria-hidden="true"
        >
          {name.toUpperCase()}
        </span>
        {/* Glow layer */}
        <span
          className="pointer-events-none absolute inset-0 select-none text-4xl tracking-wider sm:text-6xl md:text-7xl"
          style={{
            fontFamily: "'Bangers', cursive",
            color: 'transparent',
            WebkitTextStroke: `2px ${color}`,
            filter: `blur(8px)`,
            opacity: 0.6,
          }}
          aria-hidden="true"
        >
          {name.toUpperCase()}
        </span>
        {/* Main text */}
        <span
          className="relative text-4xl tracking-wider sm:text-6xl md:text-7xl"
          style={{
            fontFamily: "'Bangers', cursive",
            color,
            WebkitTextStroke: `1.5px ${strokeColor}`,
            paintOrder: 'stroke fill',
            textShadow: `0 0 30px ${glowColor}, 0 4px 0 oklch(0 0 0 / 0.4)`,
          }}
        >
          {name.toUpperCase()}
        </span>
      </div>

      {/* Avatar — defender side (after text) */}
      {!isAttacker && (
        <motion.div
          className="shrink-0 overflow-hidden rounded-full"
          style={{
            width: 56,
            height: 56,
            border: `3px solid ${color}`,
            boxShadow: `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`,
          }}
          animate={{
            boxShadow: [
              `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`,
              `0 0 30px ${glowColor}, 0 0 60px ${glowColor}`,
              `0 0 20px ${glowColor}, 0 0 40px ${glowColor}`,
            ],
          }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        >
          {image ? (
            <img
              src={image}
              alt={name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-xl font-bold"
              style={{
                fontFamily: "'Bangers', cursive",
                background: 'oklch(0.12 0.03 290)',
                color: 'oklch(0.7 0.04 290)',
              }}
            >
              {(name[0] || '?').toUpperCase()}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}

/* ═══ Phase 1: Charging ═══ */

function ChargingPhase({ players }: { players: BattlePlayers | null }) {
  return (
    <div className="relative h-full overflow-hidden">
      {/* ── Split background — blue left / red right ── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Attacker half — cool blue/pink */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: 'polygon(0 0, 58% 0, 42% 100%, 0 100%)',
            background:
              'linear-gradient(135deg, oklch(0.08 0.04 340) 0%, oklch(0.12 0.06 340) 50%, oklch(0.08 0.04 340) 100%)',
          }}
        />
        {/* Defender half — warm blue/indigo */}
        <div
          className="absolute inset-0"
          style={{
            clipPath: 'polygon(58% 0, 100% 0, 100% 100%, 42% 100%)',
            background:
              'linear-gradient(135deg, oklch(0.08 0.04 250) 0%, oklch(0.12 0.06 250) 50%, oklch(0.08 0.04 250) 100%)',
          }}
        />
      </div>

      {/* Vignette overlay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 20%, oklch(0 0 0 / 0.5) 100%)',
        }}
      />

      <SpeedLines intensity="low" />

      {/* Lightning bolt divider */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.15 }}
      >
        <LightningBolt />
      </motion.div>

      {/* Energy rings behind VS */}
      <EnergyRing delay={0} size={140} color="oklch(0.85 0.12 230 / 0.1)" />
      <EnergyRing delay={0.6} size={220} color="oklch(0.85 0.12 230 / 0.06)" />

      {players ? (
        <>
          {/* Attacker name — top left, huge */}
          <NamePlate
            name={players.attackerName}
            image={players.attackerImage}
            side="attacker"
            delay={0.15}
          />

          {/* Defender name — bottom right, huge */}
          <NamePlate
            name={players.defenderName}
            image={players.defenderImage}
            side="defender"
            delay={0.35}
          />

          {/* ── VS emblem — center, slams in with brush-stroke fury ── */}
          <motion.div
            className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
            initial={{ opacity: 0, scale: 5, rotate: -25 }}
            animate={{ opacity: 1, scale: 1, rotate: -4 }}
            transition={{
              delay: 0.6,
              duration: 0.45,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <motion.div
              animate={{
                scale: [1, 1.08, 1],
                rotate: [-4, -2, -4],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="relative"
            >
              {/* Wide glow burst behind text */}
              <span
                className="pointer-events-none absolute inset-0 select-none text-7xl tracking-wide sm:text-9xl"
                style={{
                  fontFamily: "'Permanent Marker', cursive",
                  color: 'oklch(0.85 0.15 55 / 0.3)',
                  filter: 'blur(25px)',
                }}
                aria-hidden="true"
              >
                VS
              </span>
              {/* Thick dark outline layer */}
              <span
                className="pointer-events-none absolute inset-0 select-none text-7xl tracking-wide sm:text-9xl"
                style={{
                  fontFamily: "'Permanent Marker', cursive",
                  color: 'transparent',
                  WebkitTextStroke: '8px oklch(0.15 0.08 30)',
                  paintOrder: 'stroke fill',
                }}
                aria-hidden="true"
              >
                VS
              </span>
              {/* Mid stroke — warm amber */}
              <span
                className="pointer-events-none absolute inset-0 select-none text-7xl tracking-wide sm:text-9xl"
                style={{
                  fontFamily: "'Permanent Marker', cursive",
                  color: 'transparent',
                  WebkitTextStroke: '4px oklch(0.7 0.18 55)',
                  paintOrder: 'stroke fill',
                }}
                aria-hidden="true"
              >
                VS
              </span>
              {/* Core glow layer */}
              <span
                className="pointer-events-none absolute inset-0 select-none text-7xl tracking-wide sm:text-9xl"
                style={{
                  fontFamily: "'Permanent Marker', cursive",
                  color: 'oklch(0.95 0.1 60)',
                  filter: 'blur(4px)',
                  opacity: 0.7,
                }}
                aria-hidden="true"
              >
                VS
              </span>
              {/* Main text fill */}
              <span
                className="relative text-7xl tracking-wide sm:text-9xl"
                style={{
                  fontFamily: "'Permanent Marker', cursive",
                  color: 'oklch(0.92 0.14 55)',
                  textShadow:
                    '0 0 20px oklch(0.9 0.15 55 / 0.8), 0 0 60px oklch(0.85 0.15 55 / 0.4), 0 0 100px oklch(0.8 0.12 40 / 0.2), 0 6px 0 oklch(0.15 0.08 30)',
                }}
              >
                VS
              </span>
            </motion.div>
          </motion.div>
        </>
      ) : (
        /* Fallback — centered swords */
        <div className="flex h-full items-center justify-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <motion.div
              animate={{
                scale: [1, 1.15, 1],
                rotate: [0, -3, 3, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Swords
                className="h-16 w-16"
                style={{
                  color: 'oklch(0.65 0.15 340)',
                  filter: 'drop-shadow(0 0 20px oklch(0.65 0.15 340 / 0.5))',
                }}
              />
            </motion.div>
          </motion.div>
        </div>
      )}
    </div>
  )
}

/* ═══ Phase 2: Clash ═══ */

function ClashPhase({ onComplete }: { onComplete: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1000)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="relative flex h-full items-center justify-center">
      {/* Flash */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.7, 0] }}
        transition={{ duration: 0.6, times: [0, 0.12, 1] }}
        style={{
          background:
            'radial-gradient(circle at center, oklch(1 0 0 / 0.9) 0%, oklch(0.65 0.15 340 / 0.3) 40%, transparent 70%)',
        }}
      />

      {/* Screen shake wrapper */}
      <motion.div
        className="absolute inset-0"
        animate={{
          x: [0, -6, 8, -5, 6, -3, 2, 0],
          y: [0, 4, -7, 5, -4, 2, -1, 0],
        }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        <SpeedLines intensity="high" />
        <SlashMarks />
      </motion.div>

      {/* Impact sparks */}
      <ImpactSparks color="oklch(0.85 0.12 55)" />
      <ImpactSparks color="oklch(0.65 0.15 340)" />

      {/* Expanding ring */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div
          className="rounded-full border-2"
          style={{
            width: 60,
            height: 60,
            borderColor: 'oklch(1 0 0 / 0.5)',
            animation: 'ring-expand 0.8s ease-out forwards',
          }}
        />
      </div>

      {/* Center impact icon */}
      <motion.div
        className="relative z-10"
        initial={{ scale: 2, opacity: 0 }}
        animate={{ scale: [2, 0.9, 1.1, 1], opacity: [0, 1, 1, 0.8] }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Swords
          className="h-20 w-20"
          style={{
            color: 'oklch(0.9 0.08 55)',
            filter: 'drop-shadow(0 0 30px oklch(0.85 0.12 55 / 0.8))',
          }}
        />
      </motion.div>
    </div>
  )
}

/* ═══ Phase 3: Result ═══ */

function ResultPhase({
  outcome,
  onComplete,
}: {
  outcome: BattleOutcome
  onComplete: () => void
}) {
  const config =
    outcome.won === true
      ? RESULT_CONFIG.victory
      : outcome.won === false
        ? RESULT_CONFIG.defeat
        : RESULT_CONFIG.draw

  useEffect(() => {
    const timer = setTimeout(onComplete, 2800)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="relative flex h-full items-center justify-center">
      {/* Colored vignette */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{
          background: `radial-gradient(ellipse at center, ${config.glow} 0%, transparent 60%)`,
        }}
      />

      <SpeedLines intensity="low" />

      <div className="relative z-10 flex flex-col items-center">
        {/* Result text with dramatic entrance */}
        <motion.div
          className="relative"
          initial={{ scale: 3, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            ease: [0.16, 1, 0.3, 1],
          }}
        >
          {/* Text shadow glow layer */}
          <span
            className="pointer-events-none absolute inset-0 select-none text-5xl tracking-[0.2em] sm:text-7xl"
            style={{
              fontFamily: "'Bangers', cursive",
              color: 'transparent',
              WebkitTextStroke: `2px ${config.color}`,
              filter: `blur(14px)`,
              opacity: 0.5,
            }}
            aria-hidden="true"
          >
            {config.text}
          </span>
          <span
            className="relative text-5xl tracking-[0.2em] sm:text-7xl"
            style={{
              fontFamily: "'Bangers', cursive",
              color: config.color,
              textShadow: `0 0 40px ${config.glow}, 0 0 80px ${config.glow}, 0 2px 0 oklch(0 0 0 / 0.4)`,
            }}
          >
            {config.text}
          </span>
        </motion.div>

        {/* Rating change */}
        {outcome.ratingDelta != null && outcome.ratingDelta !== 0 && (
          <motion.div
            className="mt-4 flex items-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <span
              className="text-xl tracking-wider"
              style={{
                fontFamily: "'Bangers', cursive",
                color:
                  outcome.ratingDelta > 0
                    ? RESULT_CONFIG.victory.accent
                    : RESULT_CONFIG.defeat.accent,
              }}
            >
              {outcome.ratingDelta > 0
                ? `+${outcome.ratingDelta}`
                : outcome.ratingDelta}
            </span>
            <span
              className="text-sm uppercase tracking-widest"
              style={{ color: 'oklch(0.6 0.03 290)' }}
            >
              Rating
            </span>
          </motion.div>
        )}

        {/* Mode badge */}
        <motion.div
          className="mt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
        >
          <span
            className="rounded-full border px-3 py-1 text-xs uppercase tracking-widest"
            style={{
              borderColor: 'oklch(1 0 0 / 0.08)',
              color: 'oklch(0.55 0.03 290)',
            }}
          >
            {outcome.mode === 'arena' ? 'Ranked Arena' : 'Friendly Battle'}
          </span>
        </motion.div>
      </div>
    </div>
  )
}

/* ═══ Main BattleTransition Component ═══ */

export function BattleTransition({
  active,
  players,
  outcome,
  onNavigate,
}: BattleTransitionProps) {
  const [phase, setPhase] = useState<Phase>('charging')
  const hasNavigated = useRef(false)

  // Reset when activated
  useEffect(() => {
    if (active) {
      setPhase('charging')
      hasNavigated.current = false
    }
  }, [active])

  // When outcome arrives during charging, transition to clash
  useEffect(() => {
    if (outcome && phase === 'charging') {
      // Let the VS screen breathe — minimum 1.8s so all animations play out
      const timer = setTimeout(() => setPhase('clash'), 1800)
      return () => clearTimeout(timer)
    }
  }, [outcome, phase])

  const handleClashComplete = useCallback(() => {
    setPhase('result')
  }, [])

  const handleResultComplete = useCallback(() => {
    if (outcome && !hasNavigated.current) {
      hasNavigated.current = true
      onNavigate(outcome.battleId)
    }
  }, [outcome, onNavigate])

  // Allow clicking to skip to result / navigate
  const handleClick = useCallback(() => {
    if (phase === 'charging' && outcome) {
      setPhase('clash')
    } else if (phase === 'clash') {
      setPhase('result')
    } else if (phase === 'result' && outcome && !hasNavigated.current) {
      hasNavigated.current = true
      onNavigate(outcome.battleId)
    }
  }, [phase, outcome, onNavigate])

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-0 z-50 cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClick}
          style={{
            background: 'oklch(0.06 0.02 290)',
          }}
        >
          <AnimatePresence mode="wait">
            {phase === 'charging' && (
              <motion.div
                key="charging"
                className="h-full"
                exit={{ opacity: 0, scale: 1.1 }}
                transition={{ duration: 0.2 }}
              >
                <ChargingPhase players={players} />
              </motion.div>
            )}

            {phase === 'clash' && (
              <motion.div
                key="clash"
                className="h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ClashPhase onComplete={handleClashComplete} />
              </motion.div>
            )}

            {phase === 'result' && outcome && (
              <motion.div
                key="result"
                className="h-full"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
              >
                <ResultPhase
                  outcome={outcome}
                  onComplete={handleResultComplete}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Skip hint */}
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          >
            <span
              className="text-xs tracking-wider"
              style={{ color: 'oklch(0.45 0.02 290)' }}
            >
              Tap to skip
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
