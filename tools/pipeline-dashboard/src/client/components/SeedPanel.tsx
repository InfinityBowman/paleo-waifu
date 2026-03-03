import { useState } from 'react'
import { AlertTriangle, Check, Database, Loader2, X } from 'lucide-react'
import { seedDb } from '../lib/api'

export function SeedPanel({ onClose }: { onClose: () => void }) {
  const [target, setTarget] = useState<'local' | 'prod'>('local')
  const [seeding, setSeeding] = useState(false)
  const [result, setResult] = useState<{
    ok: boolean
    creatureCount: number
    output: string
  } | null>(null)
  const [confirmProd, setConfirmProd] = useState(false)

  async function handleSeed() {
    if (target === 'prod' && !confirmProd) {
      setConfirmProd(true)
      return
    }

    setSeeding(true)
    setResult(null)
    setConfirmProd(false)

    try {
      const res = await seedDb(target)
      setResult(res)
    } catch (err) {
      setResult({
        ok: false,
        creatureCount: 0,
        output: err instanceof Error ? err.message : 'Seed failed',
      })
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[560px] rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-foreground" />
            <h3 className="text-lg font-semibold text-foreground">
              Seed Database
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={seeding}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Generate seed.sql from creatures_enriched.json and execute it
            against the selected D1 database.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setTarget('local')
                setConfirmProd(false)
              }}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                target === 'local'
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-border/80'
              }`}
            >
              <div className="font-medium">Local D1</div>
              <div className="mt-1 text-xs opacity-70">
                Development database
              </div>
            </button>
            <button
              onClick={() => {
                setTarget('prod')
                setConfirmProd(false)
              }}
              className={`flex-1 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                target === 'prod'
                  ? 'border-warning bg-warning/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-border/80'
              }`}
            >
              <div className="font-medium">Production D1</div>
              <div className="mt-1 text-xs opacity-70">Live database</div>
            </button>
          </div>

          {confirmProd && (
            <div className="flex items-start gap-2 rounded-lg bg-warning/10 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span className="text-sm text-warning">
                This will overwrite all creature data in production. Click
                &quot;Seed&quot; again to confirm.
              </span>
            </div>
          )}

          {result && (
            <div
              className={`rounded-lg px-4 py-3 ${result.ok ? 'bg-success/10' : 'bg-destructive/10'}`}
            >
              <div className="flex items-center gap-2">
                {result.ok ? (
                  <Check className="h-4 w-4 text-success" />
                ) : (
                  <X className="h-4 w-4 text-destructive" />
                )}
                <span
                  className={`text-sm font-medium ${result.ok ? 'text-success' : 'text-destructive'}`}
                >
                  {result.ok
                    ? `Seeded ${result.creatureCount} creatures`
                    : 'Seed failed'}
                </span>
              </div>
              {result.output && (
                <pre className="mt-2 max-h-[200px] overflow-auto rounded bg-background/50 p-2 font-mono text-xs text-muted-foreground">
                  {result.output}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            disabled={seeding}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Close
          </button>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {seeding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            {confirmProd ? 'Confirm Seed Production' : 'Seed'}
          </button>
        </div>
      </div>
    </div>
  )
}
