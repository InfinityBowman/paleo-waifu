import { useCallback, useEffect, useState } from 'react'
import { Header } from './components/Header'
import { CreatureList } from './components/CreatureList'
import { CreatureForm } from './components/CreatureForm'
import { SeedPanel } from './components/SeedPanel'
import { fetchCreatures } from './lib/api'
import type { Creature, Stats } from './lib/types'

type View = { kind: 'list' } | { kind: 'edit'; slug: string } | { kind: 'create' }

export function App() {
  const [view, setView] = useState<View>({ kind: 'list' })
  const [creatures, setCreatures] = useState<Array<Creature>>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [showSeed, setShowSeed] = useState(false)

  const loadCreatures = useCallback(async () => {
    const data = await fetchCreatures()
    setCreatures(data.creatures)
    setStats(data.stats)
  }, [])

  useEffect(() => {
    loadCreatures()
  }, [loadCreatures])

  function handleSaved() {
    loadCreatures()
    setView({ kind: 'list' })
  }

  function handleDeleted() {
    loadCreatures()
    setView({ kind: 'list' })
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <Header
        stats={stats}
        onAddCreature={() => setView({ kind: 'create' })}
        onSeed={() => setShowSeed(true)}
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

      {showSeed && <SeedPanel onClose={() => setShowSeed(false)} />}
    </div>
  )
}
