import type { ErrorComponentProps } from '@tanstack/react-router'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import appCss from '../styles.css?url'
import { DevAccountSwitcher } from '@/components/dev/DevAccountSwitcher'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'PaleoWaifu — Prehistoric Gacha' },
      {
        name: 'description',
        content: 'Collect waifu-fied prehistoric creatures in this gacha game!',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
    scripts: [
      {
        children: `document.documentElement.classList.add('dark')`,
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
    <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">
        This fossil couldn&apos;t be found.
      </p>
      <Link
        to="/"
        className="text-sm text-primary underline underline-offset-4 hover:text-primary/80"
      >
        Back to dig site
      </Link>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body className="bg-noise min-h-screen bg-background text-foreground antialiased">
        {children}
        {import.meta.env.DEV && <DevAccountSwitcher />}
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
