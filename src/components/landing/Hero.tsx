import { Link } from '@tanstack/react-router'
import {
  Bone,
  BookOpen,
  Crown,
  Gem,
  Globe,
  Leaf,
  Mountain,
  Shell,
  Skull,
  Sparkles,
} from 'lucide-react'
import { signIn, useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
    </svg>
  )
}

const FLOATING_ELEMENTS = [
  {
    icon: Skull,
    className: 'absolute top-16 left-[10%] h-8 w-8 text-primary/15',
    delay: '0s',
  },
  {
    icon: Bone,
    className: 'absolute top-24 right-[12%] h-6 w-6 text-primary/10',
    delay: '0.5s',
  },
  {
    icon: Leaf,
    className: 'absolute bottom-20 left-[8%] h-6 w-6 text-green-500/10',
    delay: '1s',
  },
  {
    icon: Shell,
    className: 'absolute bottom-28 right-[15%] h-8 w-8 text-blue-400/10',
    delay: '1.5s',
  },
  {
    icon: Mountain,
    className: 'absolute top-40 left-[25%] h-5 w-5 text-muted-foreground/10',
    delay: '0.7s',
  },
  {
    icon: Gem,
    className: 'absolute bottom-16 right-[30%] h-5 w-5 text-purple-400/10',
    delay: '1.2s',
  },
]

export function Hero() {
  const { data: session } = useSession()

  return (
    <section className="relative flex-1 overflow-hidden">
      {/* Multi-layer background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-purple-500/5" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,oklch(0.75_0.16_75/0.12)_0%,transparent_70%)]" />

      {/* Floating decorative elements */}
      {FLOATING_ELEMENTS.map((el, i) => (
        <el.icon
          key={i}
          className={`${el.className} animate-float pointer-events-none hidden sm:block`}
          style={{ animationDelay: el.delay }}
        />
      ))}

      <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:py-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-card px-4 py-1.5 text-sm">
          <Sparkles className="h-4 w-4 animate-sparkle text-primary" />
          Prehistoric creatures, reimagined
        </div>

        <h1 className="font-display text-5xl font-bold tracking-tight sm:text-7xl">
          Collect{' '}
          <span className="relative bg-gradient-to-r from-amber-400 via-primary to-purple-400 bg-clip-text text-transparent">
            Prehistoric Waifus
            <span className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-amber-400/60 via-primary/60 to-purple-400/60 blur-sm" />
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Dig up fossils, pull from gacha banners, and build your collection of
          waifu-fied dinosaurs, marine reptiles, and ancient mammals. Trade with
          other collectors to catch &apos;em all.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          {session ? (
            <Button asChild size="lg" className="group h-12 px-6">
              <Link to="/gacha">
                <Skull className="h-5 w-5 transition-transform group-hover:rotate-12" />
                Start Pulling
                <Sparkles className="h-4 w-4 text-primary-foreground/70" />
              </Link>
            </Button>
          ) : (
            <Button
              onClick={() => signIn.social({ provider: 'discord' })}
              size="lg"
              className="group h-12 bg-[#5865F2] px-6 text-white hover:bg-[#4752C4]"
            >
              <DiscordIcon className="h-5 w-5 transition-transform group-hover:rotate-[-8deg]" />
              Login with Discord
            </Button>
          )}
          <Button
            asChild
            variant="outline"
            size="lg"
            className="group h-12 px-6"
          >
            <Link to="/encyclopedia">
              <BookOpen className="h-5 w-5 transition-transform group-hover:rotate-[-8deg]" />
              Encyclopedia
            </Link>
          </Button>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-6 sm:gap-8">
          {[
            {
              value: '100+',
              label: 'Creatures',
              icon: Skull,
              color: 'text-primary',
            },
            {
              value: '5',
              label: 'Rarity Tiers',
              icon: Crown,
              color: 'text-purple-400',
            },
            {
              value: '3',
              label: 'Geological Eras',
              icon: Globe,
              color: 'text-blue-400',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="group rounded-xl border bg-card/50 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <stat.icon className={`mb-1 h-6 w-6 ${stat.color}`} />
              <div className="font-display text-3xl font-bold text-primary">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
