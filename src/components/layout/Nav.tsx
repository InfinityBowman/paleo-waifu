import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Archive,
  ArrowLeftRight,
  BookOpen,
  Gem,
  LogOut,
  Menu,
  Skull,
  User,
} from 'lucide-react'
import { signIn, signOut, useSession } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const NAV_LINK_CLASS =
  'flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground [&.active]:text-primary'

const MOBILE_NAV_LINK_CLASS =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground [&.active]:bg-accent [&.active]:text-foreground'

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
    </svg>
  )
}

export function Nav() {
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <TooltipProvider>
      <header className="shrink-0 border-b bg-background">
        <div className="flex h-14 items-center justify-between px-4">
          {/* Left: Logo + Desktop Nav */}
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="flex items-center gap-2 font-display text-lg font-bold"
            >
              <Skull className="h-5 w-5 text-primary" />
              PaleoWaifu
            </Link>
            <nav className="hidden items-center gap-4 md:flex">
              <Link to="/encyclopedia" className={NAV_LINK_CLASS}>
                <BookOpen className="h-4 w-4" />
                Encyclopedia
              </Link>
              {session && (
                <>
                  <Link to="/gacha" className={NAV_LINK_CLASS}>
                    <Gem className="h-4 w-4" />
                    Gacha
                  </Link>
                  <Link to="/collection" className={NAV_LINK_CLASS}>
                    <Archive className="h-4 w-4" />
                    Collection
                  </Link>
                  <Link to="/trade" className={NAV_LINK_CLASS}>
                    <ArrowLeftRight className="h-4 w-4" />
                    Trade
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* Right: Auth + Mobile Menu */}
          <div className="flex items-center gap-2">
            {/* Desktop auth area — fixed width to prevent layout shift */}
            <div className="hidden min-w-[120px] items-center justify-end gap-2 md:flex">
              {session ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="gap-2 px-2">
                      <Avatar size="sm">
                        {session.user.image ? (
                          <AvatarImage
                            src={session.user.image}
                            alt={session.user.name}
                          />
                        ) : null}
                        <AvatarFallback>
                          {session.user.name[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="max-w-[100px] truncate text-sm">
                        {session.user.name}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuLabel>{session.user.name}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link to="/profile">
                        <User className="h-4 w-4" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => signOut()}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  onClick={() => signIn.social({ provider: 'discord' })}
                  className="bg-[#5865F2] text-white hover:bg-[#4752C4]"
                  size="sm"
                >
                  <DiscordIcon className="h-4 w-4" />
                  Login with Discord
                </Button>
              )}
            </div>

            {/* Mobile menu */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2 font-display">
                    <Skull className="h-5 w-5 text-primary" />
                    PaleoWaifu
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4">
                  <Link
                    to="/encyclopedia"
                    className={MOBILE_NAV_LINK_CLASS}
                    onClick={() => setMobileOpen(false)}
                  >
                    <BookOpen className="h-4 w-4" />
                    Encyclopedia
                  </Link>
                  {session && (
                    <>
                      <Link
                        to="/gacha"
                        className={MOBILE_NAV_LINK_CLASS}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Gem className="h-4 w-4" />
                        Gacha
                      </Link>
                      <Link
                        to="/collection"
                        className={MOBILE_NAV_LINK_CLASS}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Archive className="h-4 w-4" />
                        Collection
                      </Link>
                      <Link
                        to="/trade"
                        className={MOBILE_NAV_LINK_CLASS}
                        onClick={() => setMobileOpen(false)}
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                        Trade
                      </Link>
                    </>
                  )}
                </nav>

                <Separator className="mx-4" />

                <div className="px-4">
                  {session ? (
                    <div className="flex flex-col gap-1">
                      <Link
                        to="/profile"
                        className={MOBILE_NAV_LINK_CLASS}
                        onClick={() => setMobileOpen(false)}
                      >
                        <Avatar size="sm">
                          {session.user.image ? (
                            <AvatarImage
                              src={session.user.image}
                              alt={session.user.name}
                            />
                          ) : null}
                          <AvatarFallback>
                            {session.user.name[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {session.user.name}
                      </Link>
                      <button
                        onClick={() => {
                          signOut()
                          setMobileOpen(false)
                        }}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => {
                        signIn.social({ provider: 'discord' })
                        setMobileOpen(false)
                      }}
                      className="w-full bg-[#5865F2] text-white hover:bg-[#4752C4]"
                    >
                      <DiscordIcon className="h-4 w-4" />
                      Login with Discord
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>

            {/* Mobile: show avatar or login inline */}
            <div className="flex items-center md:hidden">
              {session ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link to="/profile">
                      <Avatar size="sm">
                        {session.user.image ? (
                          <AvatarImage
                            src={session.user.image}
                            alt={session.user.name}
                          />
                        ) : null}
                        <AvatarFallback>
                          {session.user.name[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Profile</TooltipContent>
                </Tooltip>
              ) : null}
            </div>
          </div>
        </div>
      </header>
    </TooltipProvider>
  )
}
