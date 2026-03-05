import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { and, count, eq, like, sql } from 'drizzle-orm'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createDb } from '@paleo-waifu/shared/db/client'
import { currency, user, userCreature } from '@paleo-waifu/shared/db/schema'
import { getCfEnv } from '@/lib/env'
import { createAuth } from '@/lib/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { IconMagnifyingGlass } from '@/components/icons'
import { AdjustFossilsDialog } from '@/components/admin/AdjustFossilsDialog'
import { BanUserDialog } from '@/components/admin/BanUserDialog'
import { SetRoleDialog } from '@/components/admin/SetRoleDialog'

const PAGE_SIZE = 20

const getAdminUsers = createServerFn({ method: 'GET' })
  .inputValidator((d: { search?: string; role?: string; page?: number }) => d)
  .handler(async ({ data }) => {
    const cfEnv = getCfEnv()
    const auth = await createAuth(cfEnv)
    const session = await auth.api.getSession({
      headers: getRequest().headers,
    })
    if (!session || (session.user as { role?: string }).role !== 'admin') {
      throw new Error('Forbidden')
    }

    const db = await createDb(cfEnv.DB)
    const page = data.page ?? 0
    const offset = page * PAGE_SIZE

    const conditions = []
    if (data.search) {
      conditions.push(like(user.name, `%${data.search}%`))
    }
    if (data.role && data.role !== 'all') {
      conditions.push(eq(user.role, data.role))
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    const [users, totalResult] = await Promise.all([
      db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          banned: user.banned,
          banReason: user.banReason,
          createdAt: user.createdAt,
          fossils: currency.fossils,
          pullCount: count(userCreature.id),
        })
        .from(user)
        .leftJoin(currency, eq(currency.userId, user.id))
        .leftJoin(userCreature, eq(userCreature.userId, user.id))
        .where(whereClause)
        .groupBy(user.id)
        .orderBy(sql`${user.createdAt} DESC`)
        .limit(PAGE_SIZE)
        .offset(offset)
        .all(),
      db.select({ count: count() }).from(user).where(whereClause).get(),
    ])

    return {
      users,
      total: totalResult?.count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    }
  })

export const Route = createFileRoute('/admin/users')({
  validateSearch: (raw: Record<string, unknown>) => ({
    search: (raw.search as string) || '',
    role: (raw.role as string) || 'all',
    page: Number(raw.page) || 0,
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getAdminUsers({ data: deps }),
  component: UsersPage,
})

function UsersPage() {
  const { users, total, page, pageSize } = Route.useLoaderData()
  const { search, role } = Route.useSearch()
  const router = useRouter()
  const navigate = Route.useNavigate()
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold">Users</h1>
      <p className="mt-1 text-sm text-muted-foreground">{total} total users</p>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1">
          <IconMagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name..."
            defaultValue={search}
            onChange={(e) => {
              const value = e.target.value
              navigate({
                search: { search: value, role, page: 0 },
              })
            }}
          />
        </div>
        <Select
          value={role}
          onValueChange={(value) =>
            navigate({ search: { search, role: value, page: 0 } })
          }
        >
          <SelectTrigger className="w-35">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="editor">Editor</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User list */}
      <div className="mt-4 space-y-2">
        {users.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No users found.
            </CardContent>
          </Card>
        ) : (
          users.map((u) => (
            <Card key={u.id} size="sm">
              <CardContent>
                <div className="flex items-center gap-4">
                  <Link
                    to="/admin/users/$userId"
                    params={{ userId: u.id }}
                    search={{ search: '', role: 'all', page: 0 }}
                  >
                    <Avatar size="sm">
                      {u.image ? (
                        <AvatarImage src={u.image} alt={u.name} />
                      ) : null}
                      <AvatarFallback>{u.name[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link
                        to="/admin/users/$userId"
                        params={{ userId: u.id }}
                        search={{ search: '', role: 'all', page: 0 }}
                        className="truncate font-medium hover:text-primary"
                      >
                        {u.name}
                      </Link>
                      {u.role === 'admin' && (
                        <Badge variant="default" className="text-xs">
                          admin
                        </Badge>
                      )}
                      {u.role === 'editor' && (
                        <Badge variant="secondary" className="text-xs">
                          editor
                        </Badge>
                      )}
                      {u.banned && (
                        <Badge variant="destructive" className="text-xs">
                          banned
                        </Badge>
                      )}
                    </div>
                    <div className="truncate text-sm text-muted-foreground">
                      {u.email}
                    </div>
                  </div>

                  <div className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
                    <div className="text-right">
                      <div className="font-medium text-foreground">
                        {u.fossils ?? 0}
                      </div>
                      <div className="text-xs">fossils</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-foreground">
                        {u.pullCount}
                      </div>
                      <div className="text-xs">pulls</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs">
                        {u.createdAt
                          ? new Date(u.createdAt).toLocaleDateString()
                          : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <AdjustFossilsDialog
                      userId={u.id}
                      userName={u.name}
                      currentFossils={u.fossils ?? 0}
                      onSuccess={() => router.invalidate()}
                    />
                    <SetRoleDialog
                      userId={u.id}
                      userName={u.name}
                      currentRole={u.role ?? 'user'}
                      onSuccess={() => router.invalidate()}
                    />
                    <BanUserDialog
                      userId={u.id}
                      userName={u.name}
                      isBanned={u.banned ?? false}
                      onSuccess={() => router.invalidate()}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() =>
                navigate({
                  search: { search, role, page: page - 1 },
                })
              }
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() =>
                navigate({
                  search: { search, role, page: page + 1 },
                })
              }
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
