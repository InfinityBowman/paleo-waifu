import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import appCss from '../styles.css?url'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { DevAccountSwitcher } from '@/components/dev/DevAccountSwitcher'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

const CANONICAL_DOMAIN = 'paleowaifu.com'
const SITE_URL = `https://${CANONICAL_DOMAIN}`

export const Route = createRootRoute({
  headers: () => ({
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' cdn.jacobmaynard.dev cdn.discordapp.com media.discordapp.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://plausible.jacobmaynard.dev; connect-src 'self' https://plausible.jacobmaynard.dev; frame-ancestors 'none'",
  }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'PaleoWaifu — Prehistoric Gacha' },
      {
        name: 'description',
        content:
          'Collect and trade 600+ waifu-fied prehistoric creatures in this gacha game. Pull fossils, discover ancient companions, and build your collection.',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: 'PaleoWaifu' },
      { property: 'og:title', content: 'PaleoWaifu — Prehistoric Gacha' },
      {
        property: 'og:description',
        content:
          'Collect and trade 600+ waifu-fied prehistoric creatures in this gacha game. Pull fossils, discover ancient companions, and build your collection.',
      },
      { property: 'og:image', content: `${SITE_URL}/og-image.png` },
      { property: 'og:url', content: SITE_URL },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'PaleoWaifu — Prehistoric Gacha' },
      {
        name: 'twitter:description',
        content:
          'Collect and trade 600+ waifu-fied prehistoric creatures in this gacha game.',
      },
      { name: 'twitter:image', content: `${SITE_URL}/og-image.png` },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500;600;700;800&family=M+PLUS+Rounded+1c:wght@300;400;500;700;800&family=Klee+One:wght@400;600&family=Bangers&family=Permanent+Marker&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
    ],
    scripts: [
      {
        src: 'https://plausible.jacobmaynard.dev/js/pa-3bdzy4_fgkECTn6E-iKcY.js',
        async: true,
      },
      {
        children: `window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)},plausible.init=plausible.init||function(i){plausible.o=i||{}};plausible.init()`,
      },
    ],
  }),

  component: RootLayout,
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
  errorComponent: RootError,
})

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-24 text-center">
      {/* Cute confused dino */}
      <div
        className="relative mb-4"
        style={{ animation: 'notfound-fadein 0.6s ease both' }}
      >
        <svg
          viewBox="0 0 200 220"
          className="h-52 w-52"
          style={{ animation: 'notfound-sway 4s ease-in-out infinite' }}
        >
          {/* Tail */}
          <path
            d="M 50 155 Q 20 140 15 115 Q 12 100 25 105"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            className="text-primary/70"
            style={{
              transformOrigin: '50px 155px',
              animation: 'notfound-tail 2s ease-in-out infinite',
            }}
          />

          {/* Body */}
          <ellipse
            cx="100"
            cy="155"
            rx="45"
            ry="35"
            fill="currentColor"
            className="text-primary/80"
          />

          {/* Belly */}
          <ellipse
            cx="105"
            cy="162"
            rx="28"
            ry="22"
            fill="currentColor"
            className="text-primary/40"
          />

          {/* Left leg */}
          <ellipse
            cx="78"
            cy="185"
            rx="10"
            ry="14"
            fill="currentColor"
            className="text-primary/80"
          />
          {/* Right leg */}
          <ellipse
            cx="118"
            cy="185"
            rx="10"
            ry="14"
            fill="currentColor"
            className="text-primary/80"
          />
          {/* Left foot */}
          <ellipse
            cx="78"
            cy="197"
            rx="13"
            ry="6"
            fill="currentColor"
            className="text-primary/90"
          />
          {/* Right foot */}
          <ellipse
            cx="118"
            cy="197"
            rx="13"
            ry="6"
            fill="currentColor"
            className="text-primary/90"
          />

          {/* Neck */}
          <path
            d="M 105 130 Q 112 105 115 90"
            fill="none"
            stroke="currentColor"
            strokeWidth="22"
            strokeLinecap="round"
            className="text-primary/80"
          />

          {/* Head */}
          <ellipse
            cx="120"
            cy="78"
            rx="28"
            ry="24"
            fill="currentColor"
            className="text-primary/80"
          />

          {/* Snout */}
          <ellipse
            cx="143"
            cy="82"
            rx="16"
            ry="14"
            fill="currentColor"
            className="text-primary/80"
          />

          {/* Mouth line */}
          <path
            d="M 135 90 Q 148 93 156 88"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="text-primary"
          />

          {/* Nostril */}
          <circle
            cx="153"
            cy="80"
            r="2.5"
            fill="currentColor"
            className="text-primary"
          />

          {/* Eye white */}
          <ellipse
            cx="118"
            cy="72"
            rx="10"
            ry="11"
            fill="currentColor"
            className="text-foreground/90"
          />
          {/* Eye pupil — looks up confused */}
          <ellipse
            cx="119"
            cy="69"
            rx="5.5"
            ry="6"
            fill="currentColor"
            className="text-background"
          />
          {/* Eye shine */}
          <circle
            cx="121"
            cy="67"
            r="2.5"
            fill="currentColor"
            className="text-foreground/80"
          />

          {/* Blush */}
          <ellipse
            cx="133"
            cy="86"
            rx="6"
            ry="3.5"
            fill="currentColor"
            className="text-primary/30"
          />

          {/* Little arm (left, reaching out) */}
          <path
            d="M 72 145 Q 60 135 55 128"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className="text-primary/80"
          />
          {/* Little arm (right) */}
          <path
            d="M 130 140 Q 140 130 145 125"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className="text-primary/80"
          />

          {/* Back spines */}
          <circle
            cx="88"
            cy="122"
            r="5"
            fill="currentColor"
            className="text-primary"
          />
          <circle
            cx="98"
            cy="116"
            r="6"
            fill="currentColor"
            className="text-primary"
          />
          <circle
            cx="109"
            cy="114"
            r="5"
            fill="currentColor"
            className="text-primary"
          />

          {/* Question mark floating above head */}
          <g
            style={{ animation: 'notfound-question 2.5s ease-in-out infinite' }}
          >
            <text
              x="140"
              y="42"
              fontSize="30"
              fontWeight="bold"
              fill="currentColor"
              className="text-muted-foreground/70"
              textAnchor="middle"
            >
              ?
            </text>
          </g>
        </svg>
      </div>

      <h1
        className="text-6xl font-bold tracking-tight text-primary"
        style={{
          animation:
            'notfound-drop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        404
      </h1>
      <p
        className="mt-1 text-muted-foreground"
        style={{ animation: 'notfound-fadein 0.8s ease both 0.3s' }}
      >
        This fossil couldn&apos;t be found.
      </p>
      <p
        className="text-sm text-muted-foreground/60"
        style={{ animation: 'notfound-fadein 0.8s ease both 0.5s' }}
      >
        It may have gone extinct... or never existed.
      </p>
      <Link
        to="/"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-5 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        style={{ animation: 'notfound-fadein 0.8s ease both 0.7s' }}
      >
        <span>&larr;</span> Back to dig site
      </Link>

      <style>{`
        @keyframes notfound-sway {
          0%, 100% { transform: rotate(-1.5deg); }
          50% { transform: rotate(1.5deg); }
        }
        @keyframes notfound-tail {
          0%, 100% { transform: rotate(-5deg); }
          50% { transform: rotate(5deg); }
        }
        @keyframes notfound-question {
          0%, 100% { transform: translateY(0); opacity: 0.7; }
          50% { transform: translateY(-8px); opacity: 1; }
        }
        @keyframes notfound-drop {
          0% { transform: translateY(-30px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        @keyframes notfound-fadein {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-paleo min-h-screen bg-background text-foreground antialiased">
        <TooltipProvider>{children}</TooltipProvider>
        {import.meta.env.DEV && <DevAccountSwitcher />}
        <Toaster />
        <Scripts />
      </body>
    </html>
  )
}

function RootError({ error, reset }: ErrorComponentProps) {
  const message = import.meta.env.DEV
    ? error.message
    : 'An unexpected error occurred. Please try refreshing.'

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
      <h1 className="text-4xl font-bold">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">{message}</p>
      <button
        onClick={reset}
        className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
      >
        Try again
      </button>
      <Link
        to="/"
        className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
      >
        Back to dig site
      </Link>
    </div>
  )
}

function RootLayout() {
  return <Outlet />
}
