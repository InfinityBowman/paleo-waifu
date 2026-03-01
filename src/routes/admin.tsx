import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { AdminNav } from '@/components/admin/AdminNav'
import { getSession } from '@/lib/auth-server'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const session = await getSession()
    if (!session) {
      throw redirect({ to: '/' })
    }
    if ((session.user as { role?: string }).role !== 'admin') {
      throw redirect({ to: '/' })
    }
    return { session }
  },
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <div className="flex h-screen flex-col overflow-x-clip md:flex-row">
      <AdminNav />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
