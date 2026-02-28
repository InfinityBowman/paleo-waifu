import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  IconCardExchange,
  IconFloatingCrystal,
  IconTreasureChest,
} from '@/components/icons'
import { signIn, useSession } from '@/lib/auth-client'

export function Hero() {
  const { data: session } = useSession()
  const [mounted, setMounted] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Hybrid particle system: soft pollen glows + sparkle stars
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight * 2
    }
    resize()
    window.addEventListener('resize', resize)

    const particles: Array<{
      x: number
      y: number
      size: number
      speedX: number
      speedY: number
      opacity: number
      phase: number
      type: 'glow' | 'star' | 'diamond'
      hue: number
    }> = []

    // Soft pollen glows
    for (let i = 0; i < 35; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 0.3,
        speedY: -Math.random() * 0.2 - 0.05,
        opacity: Math.random() * 0.35 + 0.08,
        phase: Math.random() * Math.PI * 2,
        type: 'glow',
        hue: [320, 280, 200][Math.floor(Math.random() * 3)],
      })
    }

    // Sparkle stars & diamonds
    for (let i = 0; i < 18; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 3 + 1.5,
        speedX: (Math.random() - 0.5) * 0.15,
        speedY: -Math.random() * 0.4 - 0.1,
        opacity: Math.random() * 0.5 + 0.1,
        phase: Math.random() * Math.PI * 2,
        type: Math.random() > 0.5 ? 'star' : 'diamond',
        hue: 0,
      })
    }

    let frame: number
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((p) => {
        p.x += p.speedX + (p.type === 'glow' ? Math.sin(p.phase) * 0.15 : 0)
        p.y += p.speedY
        p.phase += p.type === 'glow' ? 0.01 : 0.025
        const o = p.opacity * (0.5 + Math.sin(p.phase * 2) * 0.5)

        if (p.y < -15) {
          p.y = canvas.height + 15
          p.x = Math.random() * canvas.width
        }

        if (p.type === 'glow') {
          const gradient = ctx.createRadialGradient(
            p.x,
            p.y,
            0,
            p.x,
            p.y,
            p.size * 3,
          )
          gradient.addColorStop(0, `hsla(${p.hue}, 50%, 80%, ${o})`)
          gradient.addColorStop(1, `hsla(${p.hue}, 50%, 80%, 0)`)
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2)
          ctx.fill()
          ctx.fillStyle = `hsla(${p.hue}, 50%, 92%, ${o * 1.4})`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.save()
          ctx.translate(p.x, p.y)
          ctx.rotate(p.phase * 0.5)
          ctx.globalAlpha = o

          if (p.type === 'star') {
            ctx.fillStyle = '#ffd4ef'
            ctx.beginPath()
            for (let j = 0; j < 4; j++) {
              const angle = (j * Math.PI) / 2
              ctx.lineTo(
                Math.cos(angle) * p.size * 1.4,
                Math.sin(angle) * p.size * 1.4,
              )
              ctx.lineTo(
                Math.cos(angle + Math.PI / 4) * p.size * 0.35,
                Math.sin(angle + Math.PI / 4) * p.size * 0.35,
              )
            }
            ctx.closePath()
            ctx.fill()
          } else {
            ctx.fillStyle = '#c8baff'
            ctx.beginPath()
            ctx.moveTo(0, -p.size)
            ctx.lineTo(p.size * 0.55, 0)
            ctx.lineTo(0, p.size)
            ctx.lineTo(-p.size * 0.55, 0)
            ctx.closePath()
            ctx.fill()
          }
          ctx.restore()
        }
      })

      frame = requestAnimationFrame(animate)
    }
    animate()

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="relative overflow-hidden">
      {/* Particle canvas */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-10"
        style={{ opacity: 0.75 }}
      />

      {/* Twinkling stars */}
      {Array.from({ length: 25 }).map((_, i) => (
        <div
          key={i}
          className="pointer-events-none fixed z-0 rounded-full"
          style={{
            width: Math.random() * 2 + 1,
            height: Math.random() * 2 + 1,
            top: `${Math.random() * 55}%`,
            left: `${Math.random() * 100}%`,
            background: `oklch(1 0 0 / ${Math.random() * 0.35 + 0.08})`,
            animation: `star-twinkle ${3 + Math.random() * 4}s ease-in-out infinite ${Math.random() * 3}s`,
          }}
        />
      ))}

      {/* Rotating decorative ring */}
      <div
        className="pointer-events-none fixed top-1/2 left-1/2 z-0"
        style={{
          width: 480,
          height: 480,
          animation: 'ring-rotate 35s linear infinite',
        }}
      >
        <svg
          viewBox="0 0 480 480"
          fill="none"
          style={{ width: '100%', height: '100%' }}
        >
          <circle
            cx="240"
            cy="240"
            r="220"
            stroke="oklch(0.84 0.08 290 / 0.03)"
            strokeWidth="1"
            strokeDasharray="3 14"
          />
          <circle
            cx="240"
            cy="240"
            r="190"
            stroke="oklch(0.74 0.06 280 / 0.025)"
            strokeWidth="1"
            strokeDasharray="2 20"
          />
        </svg>
      </div>

      {/* Breathing ambient orb */}
      <div
        className="animate-breathe pointer-events-none fixed top-[35%] left-1/2 z-0 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 420,
          height: 420,
          background:
            'radial-gradient(circle, oklch(0.7 0.1 300 / 0.06) 0%, transparent 70%)',
        }}
      />

      {/* ═══ HERO ═══ */}
      <section className="relative z-20 flex min-h-screen flex-col items-center justify-center px-5">
        {/* Poetic whisper badge */}
        <div className="animate-drift-in drift-d1 paleo-badge mb-6 border border-primary/15 bg-primary/8 text-lavender/70">
          <span style={{ fontSize: 12 }}>&#10022;</span>
          <span className="font-hand text-xs tracking-wider">
            where ancient things dream again
          </span>
          <span style={{ fontSize: 12 }}>&#10022;</span>
        </div>

        {/* Animated title */}
        <div className="animate-drift-in drift-d2 text-center">
          <div className="animate-sway">
            <h1 className="paleo-title-grad font-display text-6xl leading-[1.08] font-medium sm:text-8xl md:text-[9rem]">
              Paleo
              <br />
              <span className="font-normal italic">Waifu</span>
            </h1>
          </div>
        </div>

        {/* Description */}
        <p className="animate-drift-in drift-d3 mt-8 max-w-md text-center text-sm leading-relaxed font-light text-lavender-light/50 sm:text-base">
          Collect{' '}
          <span className="text-primary/80">100+ prehistoric companions</span>{' '}
          from across the ages. Pull, discover, and trade. Each fossil holds a
          gentle secret.
        </p>

        {/* CTA buttons */}
        <div className="animate-drift-in drift-d4 mt-10 flex flex-col items-center gap-3">
          {session ? (
            <Link
              to="/gacha"
              className="paleo-pull-btn flex items-center gap-3 px-12 py-4 text-lg font-bold tracking-wide text-white"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 1L12.5 7.5L19 10L12.5 12.5L10 19L7.5 12.5L1 10L7.5 7.5Z"
                  fill="white"
                  opacity="0.85"
                />
              </svg>
              Summon Now
            </Link>
          ) : (
            <button
              onClick={() => signIn.social({ provider: 'discord' })}
              className="paleo-pull-btn flex items-center gap-3 px-12 py-4 text-lg font-bold tracking-wide text-white"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 1L12.5 7.5L19 10L12.5 12.5L10 19L7.5 12.5L1 10L7.5 7.5Z"
                  fill="white"
                  opacity="0.85"
                />
              </svg>
              Summon Now
            </button>
          )}
          <span className="font-hand text-[11px] text-lavender/30">
            &#10022; 1 Fossil = Single Pull &middot; 10 Fossils = Multi Pull
            &#10022;
          </span>
        </div>

        {/* Secondary CTA */}
        <Link
          to="/encyclopedia"
          className="paleo-outline-btn animate-drift-in drift-d5 mt-4 px-8 py-2.5 text-xs font-medium tracking-wider"
        >
          Browse Encyclopedia &rarr;
        </Link>

        {/* Scroll indicator */}
        <div className="animate-drift-in drift-d6 absolute bottom-10 flex flex-col items-center gap-2">
          <div className="animate-float h-6 w-4 rounded-full border border-lavender/12">
            <div className="mx-auto mt-1 h-1.5 w-1 rounded-full bg-lavender/25" />
          </div>
        </div>
      </section>

      {/* ═══ ABOUT — era cards ═══ */}
      <section className="relative z-20 px-5 py-24 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-12 md:grid-cols-2 md:items-center">
            <div>
              <p className="mb-4 font-hand text-xs tracking-widest text-rarity-uncommon/40">
                ~ about this world ~
              </p>
              <h2 className="mb-6 font-display text-3xl leading-relaxed font-light text-heading sm:text-4xl">
                Creatures of
                <br />
                <span className="italic text-lavender/75">forgotten time</span>
              </h2>
              <p className="text-sm leading-[1.9] font-light text-lavender-light/40">
                Deep beneath stone and sediment, they slept for millions of
                years. Now they stir, reimagined as gentle companions, ready to
                walk beside you. Over one hundred species across three ancient
                eras, each one waiting to be found.
              </p>
            </div>

            <div className="space-y-4">
              {[
                {
                  era: 'Paleozoic',
                  desc: 'Ancient oceans teeming with trilobites and armored fish',
                  period: '541\u2013252 Ma',
                  hue: 200,
                },
                {
                  era: 'Mesozoic',
                  desc: 'Dinosaurs, pterosaurs, and marine titans rule the world',
                  period: '252\u201366 Ma',
                  hue: 280,
                },
                {
                  era: 'Cenozoic',
                  desc: 'Mammoths, saber-tooths, and the rise of gentle giants',
                  period: '66 Ma\u2013Now',
                  hue: 340,
                },
              ].map((era, i) => (
                <div
                  key={era.era}
                  className="glass-card group p-5"
                  style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? 'translateX(0)' : 'translateX(25px)',
                    transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.2 + i * 0.12}s`,
                  }}
                >
                  <div className="flex items-baseline justify-between">
                    <h3
                      className="font-display text-base font-medium"
                      style={{
                        color: `oklch(0.75 0.1 ${era.hue} / 0.75)`,
                      }}
                    >
                      {era.era}
                    </h3>
                    <span className="font-hand text-[10px] text-lavender-light/20">
                      {era.period}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs font-light text-lavender-light/35">
                    {era.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ RARITY — glow dots + star ratings ═══ */}
      <section className="relative z-20 px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <p className="mb-3 font-hand text-xs text-lavender/35">
              ~ five kinds of wonder ~
            </p>
            <h2 className="font-display text-3xl font-light text-heading sm:text-4xl">
              Rarity of Spirit
            </h2>
          </div>

          <div className="space-y-3">
            {[
              {
                name: 'Common',
                stars: 1,
                rate: '50%',
                cssVar: '--color-rarity-common',
                opacity: 0.6,
                glowOpacity: 0.04,
              },
              {
                name: 'Uncommon',
                stars: 2,
                rate: '30%',
                cssVar: '--color-rarity-uncommon',
                opacity: 0.6,
                glowOpacity: 0.04,
              },
              {
                name: 'Rare',
                stars: 3,
                rate: '15%',
                cssVar: '--color-rarity-rare',
                opacity: 0.7,
                glowOpacity: 0.05,
              },
              {
                name: 'Epic',
                stars: 4,
                rate: '4%',
                cssVar: '--color-rarity-epic',
                opacity: 0.75,
                glowOpacity: 0.05,
              },
              {
                name: 'Legendary',
                stars: 5,
                rate: '1%',
                cssVar: '--color-rarity-legendary',
                opacity: 0.85,
                glowOpacity: 0.06,
              },
            ].map((r, i) => {
              const color = `color-mix(in oklch, var(${r.cssVar}) ${Math.round(r.opacity * 100)}%, transparent)`
              const glow = `color-mix(in oklch, var(${r.cssVar}) ${Math.round(r.glowOpacity * 100)}%, transparent)`
              return (
                <div
                  key={r.name}
                  className="flex items-center gap-4 rounded-xl px-5 py-3.5 transition-all duration-500 hover:translate-x-1 sm:gap-6"
                  style={{
                    background: glow,
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? 'translateY(0)' : 'translateY(12px)',
                    transition: `all 0.5s ease ${0.1 + i * 0.07}s`,
                  }}
                >
                  <div
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{
                      background: color,
                      boxShadow: `0 0 10px ${color}`,
                    }}
                  />
                  <span
                    className="w-24 font-display text-sm font-medium sm:w-28"
                    style={{ color }}
                  >
                    {r.name}
                  </span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: r.stars }).map((_, s) => (
                      <span key={s} style={{ color, fontSize: 10 }}>
                        &#9733;
                      </span>
                    ))}
                    {Array.from({ length: 5 - r.stars }).map((_, s) => (
                      <span
                        key={s}
                        style={{
                          color: 'oklch(1 0 0 / 0.06)',
                          fontSize: 10,
                        }}
                      >
                        &#9733;
                      </span>
                    ))}
                  </div>
                  <div
                    className="h-px flex-1"
                    style={{
                      background: `color-mix(in oklch, var(${r.cssVar}) 8%, transparent)`,
                    }}
                  />
                  <span className="text-xs font-light text-lavender-light/25">
                    {r.rate}
                  </span>
                </div>
              )
            })}
          </div>

          <p className="mt-8 text-center font-hand text-xs italic text-lavender/25">
            A legendary spirit is guaranteed to appear within 90 encounters...
          </p>
        </div>
      </section>

      {/* ═══ MECHANICS — feature cards ═══ */}
      <section className="relative z-20 px-5 py-16 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                icon: IconTreasureChest,
                title: 'New Player Bonus',
                desc: '20 free Fossils to begin your journey. Login daily for 3 more.',
                cssVar: '--color-primary',
                opacity: 0.7,
              },
              {
                icon: IconFloatingCrystal,
                title: 'Pity System',
                desc: 'Boosted rates at 50 pulls. Guaranteed Legendary at 90.',
                cssVar: '--color-rarity-epic',
                opacity: 0.7,
              },
              {
                icon: IconCardExchange,
                title: 'Trading Post',
                desc: 'Trade duplicates with other collectors to complete your album.',
                cssVar: '--color-rarity-legendary',
                opacity: 0.7,
              },
            ].map((feature, i) => {
              const accent = `color-mix(in oklch, var(${feature.cssVar}) ${Math.round(feature.opacity * 100)}%, transparent)`
              return (
                <div
                  key={feature.title}
                  className="glass-card group p-6"
                  style={{
                    opacity: mounted ? 1 : 0,
                    transform: mounted ? 'translateY(0)' : 'translateY(20px)',
                    transition: `all 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${0.15 + i * 0.1}s`,
                  }}
                >
                  <feature.icon className="h-8 w-8" style={{ color: accent }} />
                  <h3
                    className="mt-3 text-sm font-bold"
                    style={{ color: accent }}
                  >
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed font-light text-lavender-light/35">
                    {feature.desc}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <section className="relative z-20 px-5 py-12">
        <div className="mx-auto max-w-2xl rounded-2xl border border-white/[0.03] bg-white/[0.015] px-8 py-8">
          <div className="flex flex-wrap items-center justify-around gap-8">
            {[
              {
                val: '100+',
                label: 'spirits',
                cssVar: '--color-primary',
                opacity: 0.6,
              },
              {
                val: '5',
                label: 'rarities',
                cssVar: '--color-rarity-epic',
                opacity: 0.6,
              },
              {
                val: '3',
                label: 'eras',
                cssVar: '--color-rarity-uncommon',
                opacity: 0.6,
              },
              {
                val: '\u221E',
                label: 'trades',
                cssVar: '--color-rarity-legendary',
                opacity: 0.6,
              },
            ].map((s) => {
              const color = `color-mix(in oklch, var(${s.cssVar}) ${Math.round(s.opacity * 100)}%, transparent)`
              return (
                <div key={s.label} className="text-center">
                  <div
                    className="font-display text-3xl font-light sm:text-4xl"
                    style={{ color }}
                  >
                    {s.val}
                  </div>
                  <p className="mt-1 font-hand text-[10px] text-lavender-light/20">
                    {s.label}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══ FINAL CTA ═══ */}
      <section className="relative z-20 px-5 py-32">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="mb-4 font-display text-4xl font-light text-heading sm:text-5xl">
            Will you wake
            <br />
            <span className="paleo-title-grad font-normal italic">
              what sleeps below?
            </span>
          </h2>

          <p className="mb-10 text-sm font-light text-lavender-light/30">
            Every fossil holds a gentle secret &#10022;
          </p>

          {session ? (
            <Link
              to="/gacha"
              className="paleo-pull-btn inline-flex items-center gap-3 px-14 py-5 text-lg font-bold tracking-wide text-white"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 1L12.5 7.5L19 10L12.5 12.5L10 19L7.5 12.5L1 10L7.5 7.5Z"
                  fill="white"
                  opacity="0.85"
                />
              </svg>
              Start Summoning
            </Link>
          ) : (
            <button
              onClick={() => signIn.social({ provider: 'discord' })}
              className="paleo-pull-btn inline-flex items-center gap-3 px-14 py-5 text-lg font-bold tracking-wide text-white"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 1L12.5 7.5L19 10L12.5 12.5L10 19L7.5 12.5L1 10L7.5 7.5Z"
                  fill="white"
                  opacity="0.85"
                />
              </svg>
              Start Summoning
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
