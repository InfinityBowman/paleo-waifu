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
        <footer className="border-t border-white/[0.03] py-6 text-center font-hand text-[10px] text-lavender/15">
          PaleoWaifu — a dream of ancient things
        </footer>
      </main>
    </div>
  )
}
