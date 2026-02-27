import { Outlet, createFileRoute } from '@tanstack/react-router'
import { Nav } from '@/components/layout/Nav'

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Nav />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
        <footer className="border-t py-6 text-center text-sm text-muted-foreground">
          PaleoWaifu — Prehistoric creatures, reimagined.
        </footer>
      </main>
    </div>
  )
}
