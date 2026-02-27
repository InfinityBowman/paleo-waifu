import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { Nav } from '@/components/layout/Nav'
import { getSession } from '@/lib/auth-server'

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/' })
    }
    return { session }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
