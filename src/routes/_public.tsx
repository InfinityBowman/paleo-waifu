import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Nav } from '@/components/layout/Nav'

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        PaleoWaifu — Prehistoric creatures, reimagined.
      </footer>
    </div>
  )
}
