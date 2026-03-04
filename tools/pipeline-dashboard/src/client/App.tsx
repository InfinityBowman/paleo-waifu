import { useCallback, useEffect, useState } from 'react'
import { Header } from './components/Header'
import { CreatureList } from './components/CreatureList'
import { CreatureForm } from './components/CreatureForm'
import { R2Panel } from './components/R2Panel'
import { LoginScreen } from './components/LoginScreen'
import { fetchCreatures, fetchMe, logout } from './lib/api'
import type { Creature, Stats } from './lib/types'

type View =
  | { kind: 'list' }
  | { kind: 'edit'; slug: string }
  | { kind: 'create' }

interface User {
  id: string
  name: string
  image: string | null
  role: string
}

export function App() {
  const [authState, setAuthState] = useState<
    'loading' | 'unauthenticated' | User
  >('loading')
  const [view, setView] = useState<View>({ kind: 'list' })
  const [creatures, setCreatures] = useState<Array<Creature>>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [showR2, setShowR2] = useState(false)

  useEffect(() => {
    fetchMe()
      .then((data) => {
        if (data?.user) setAuthState(data.user)
        else setAuthState('unauthenticated')
      })
      .catch(() => setAuthState('unauthenticated'))
  }, [])

  const loadCreatures = useCallback(async () => {
    const data = await fetchCreatures()
    setCreatures(data.creatures)
    setStats(data.stats)
  }, [])

  useEffect(() => {
    if (typeof authState === 'object') {
      loadCreatures()
    }
  }, [authState, loadCreatures])

  async function handleLogout() {
    await logout()
    setAuthState('unauthenticated')
  }

  function handleSaved() {
    loadCreatures()
    setView({ kind: 'list' })
  }

  function handleDeleted() {
    loadCreatures()
    setView({ kind: 'list' })
  }

  if (authState === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    )
  }

  if (authState === 'unauthenticated') {
    return <LoginScreen />
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Header
        stats={stats}
        user={authState}
        onAddCreature={() => setView({ kind: 'create' })}
        onR2={() => setShowR2(true)}
        onLogout={handleLogout}
      />

      {view.kind === 'list' && (
        <CreatureList
          creatures={creatures}
          onSelect={(slug) => setView({ kind: 'edit', slug })}
        />
      )}

      {view.kind === 'edit' && (
        <CreatureForm
          slug={view.slug}
          onBack={() => setView({ kind: 'list' })}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {view.kind === 'create' && (
        <CreatureForm
          slug={null}
          onBack={() => setView({ kind: 'list' })}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}

      {showR2 && <R2Panel onClose={() => setShowR2(false)} />}
    </div>
  )
}
