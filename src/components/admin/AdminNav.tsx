import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  BarChart3,
  LayoutDashboard,
  Menu,
  Shield,
  Users,
} from 'lucide-react'
import { useSession } from '@/lib/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const NAV_LINK_CLASS =
  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-lavender/60 hover:bg-white/4 hover:text-lavender-light/90 transition-colors [&.active]:bg-primary/10 [&.active]:text-primary'

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
] as const

function NavLinks({ onClick }: { onClick?: () => void }) {
  return (
    <>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={NAV_LINK_CLASS}
          activeOptions={{ exact: item.to === '/admin' }}
          onClick={onClick}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </>
  )
}

export function AdminNav() {
  const { data: session } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border bg-background/80 backdrop-blur-xl md:flex">
        <div className="flex h-14 items-center gap-2 px-4 font-display text-lg font-bold">
          <Shield className="h-5 w-5 text-primary" />
          Admin
        </div>

        <Separator />

        <nav className="flex flex-1 flex-col gap-1 p-3">
          <NavLinks />
        </nav>

        <Separator />

        <div className="p-3">
          <Link to="/gacha" className={NAV_LINK_CLASS}>
            <ArrowLeft className="h-4 w-4" />
            Back to Game
          </Link>
        </div>

        {session && (
          <>
            <Separator />
            <div className="flex items-center gap-2 p-3">
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
              <span className="truncate text-sm text-muted-foreground">
                {session.user.name}
              </span>
            </div>
          </>
        )}
      </aside>

      {/* Mobile topbar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2 font-display">
                <Shield className="h-5 w-5 text-primary" />
                Admin
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col gap-1 px-4">
              <NavLinks onClick={() => setMobileOpen(false)} />
            </nav>
            <Separator className="mx-4" />
            <div className="px-4">
              <Link
                to="/gacha"
                className={NAV_LINK_CLASS}
                onClick={() => setMobileOpen(false)}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Game
              </Link>
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <Shield className="h-5 w-5 text-primary" />
          Admin
        </div>
      </header>
    </>
  )
}
