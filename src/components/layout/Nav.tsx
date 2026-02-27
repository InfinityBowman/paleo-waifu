import { Link } from '@tanstack/react-router'
import { useSession, signIn, signOut } from '@/lib/auth-client'
import { Skull, BookOpen, Gem, Archive, ArrowLeftRight, User, LogOut } from 'lucide-react'

export function Nav() {
  const { data: session, isPending } = useSession()

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 text-lg font-bold">
            <Skull className="h-5 w-5 text-primary" />
            PaleoWaifu
          </Link>
          <nav className="hidden items-center gap-4 md:flex">
            <Link
              to="/encyclopedia"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground [&.active]:text-foreground [&.active]:font-medium"
            >
              <BookOpen className="h-4 w-4" />
              Encyclopedia
            </Link>
            {session && (
              <>
                <Link
                  to="/gacha"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground [&.active]:text-foreground [&.active]:font-medium"
                >
                  <Gem className="h-4 w-4" />
                  Gacha
                </Link>
                <Link
                  to="/collection"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground [&.active]:text-foreground [&.active]:font-medium"
                >
                  <Archive className="h-4 w-4" />
                  Collection
                </Link>
                <Link
                  to="/trade"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground [&.active]:text-foreground [&.active]:font-medium"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  Trade
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isPending ? (
            <div className="h-9 w-20 animate-pulse rounded-md bg-muted" />
          ) : session ? (
            <div className="flex items-center gap-3">
              <Link
                to="/profile"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {session.user.image ? (
                  <img
                    src={session.user.image}
                    alt=""
                    className="h-7 w-7 rounded-full"
                  />
                ) : (
                  <User className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{session.user.name}</span>
              </Link>
              <button
                onClick={() => signOut()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn.social({ provider: 'discord' })}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-[#5865F2] px-4 text-sm font-medium text-white hover:bg-[#4752C4]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
              </svg>
              Login with Discord
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
