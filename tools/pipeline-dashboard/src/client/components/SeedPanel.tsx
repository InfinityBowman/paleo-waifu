import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  Cloud,
  Database,
  Loader2,
  Trash2,
  X,
} from 'lucide-react'
import { cleanR2, seedDb, syncR2, type SyncProgress } from '../lib/api'

type Tab = 'seed' | 'r2'

export function SeedPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('seed')
  const [busy, setBusy] = useState(false)

  // Seed state
  const [target, setTarget] = useState<'local' | 'prod'>('local')
  const [seedResult, setSeedResult] = useState<{
    ok: boolean
    creatureCount: number
    output: string
  } | null>(null)
  const [confirmProd, setConfirmProd] = useState(false)

  // R2 state
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [cleanResult, setCleanResult] = useState<{
    deleted: number
    errors: string[]
  } | null>(null)

  async function handleSeed() {
    if (target === 'prod' && !confirmProd) {
      setConfirmProd(true)
      return
    }

    setBusy(true)
    setSeedResult(null)
    setConfirmProd(false)

    try {
      const res = await seedDb(target)
      setSeedResult(res)
    } catch (err) {
      setSeedResult({
        ok: false,
        creatureCount: 0,
        output: err instanceof Error ? err.message : 'Seed failed',
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleSync() {
    setBusy(true)
    setSyncProgress(null)

    try {
      await syncR2((progress) => setSyncProgress(progress))
    } catch (err) {
      setSyncProgress({
        total: 0,
        uploaded: 0,
        skipped: 0,
        failed: 1,
        current: err instanceof Error ? err.message : 'Sync failed',
        errors: [err instanceof Error ? err.message : 'Sync failed'],
        done: true,
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleClean() {
    setBusy(true)
    setCleanResult(null)

    try {
      const res = await cleanR2()
      setCleanResult(res)
    } catch (err) {
      setCleanResult({
        deleted: 0,
        errors: [err instanceof Error ? err.message : 'Clean failed'],
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[560px] rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-border">
              <button
                onClick={() => setTab('seed')}
                className={`flex items-center gap-1.5 rounded-l-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === 'seed'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Database className="h-3.5 w-3.5" />
                Seed DB
              </button>
              <button
                onClick={() => setTab('r2')}
                className={`flex items-center gap-1.5 rounded-r-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === 'r2'
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Cloud className="h-3.5 w-3.5" />
                R2 Images
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {tab === 'seed' && (
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

            {seedResult && (
              <ResultBanner
                ok={seedResult.ok}
                message={
                  seedResult.ok
                    ? `Seeded ${seedResult.creatureCount} creatures`
                    : 'Seed failed'
                }
                detail={seedResult.output}
              />
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSeed}
                disabled={busy}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Database className="h-4 w-4" />
                )}
                {confirmProd ? 'Confirm Seed Production' : 'Seed'}
              </button>
            </div>
          </div>
        )}

        {tab === 'r2' && (
          <div className="space-y-4 p-6">
            <p className="text-sm text-muted-foreground">
              Upload all local images to production R2 with proper cache
              headers, or clean up orphaned objects.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleSync}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-border px-4 py-3 text-sm font-medium transition-colors hover:border-primary hover:bg-primary/5 disabled:opacity-50"
              >
                <Cloud className="h-4 w-4" />
                <div>
                  <div className="font-medium">Sync All to R2</div>
                  <div className="mt-0.5 text-xs opacity-70">
                    Upload all images
                  </div>
                </div>
              </button>
              <button
                onClick={handleClean}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-border px-4 py-3 text-sm font-medium transition-colors hover:border-warning hover:bg-warning/5 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <div>
                  <div className="font-medium">Clean Orphaned</div>
                  <div className="mt-0.5 text-xs opacity-70">
                    Remove stale objects
                  </div>
                </div>
              </button>
            </div>

            {syncProgress && <SyncProgressBar progress={syncProgress} />}

            {cleanResult && (
              <ResultBanner
                ok={cleanResult.errors.length === 0}
                message={
                  cleanResult.deleted > 0
                    ? `Deleted ${cleanResult.deleted} orphaned objects`
                    : 'No orphaned objects found'
                }
                detail={
                  cleanResult.errors.length > 0
                    ? cleanResult.errors.join('\n')
                    : undefined
                }
              />
            )}
          </div>
        )}

        <div className="flex justify-end border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function SyncProgressBar({ progress }: { progress: SyncProgress }) {
  const processed = progress.uploaded + progress.skipped + progress.failed
  const pct = progress.total > 0 ? (processed / progress.total) * 100 : 0

  return (
    <div className="space-y-2 rounded-lg bg-muted/50 px-4 py-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">
          {progress.done ? (
            <span className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-success" />
              Sync complete
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading...
            </span>
          )}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {processed} / {progress.total}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-background">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>
          <span className="text-success">{progress.uploaded}</span> uploaded
        </span>
        <span>
          <span className="text-muted-foreground">{progress.skipped}</span>{' '}
          skipped
        </span>
        {progress.failed > 0 && (
          <span>
            <span className="text-destructive">{progress.failed}</span> failed
          </span>
        )}
      </div>

      {!progress.done && (
        <div className="truncate text-xs text-muted-foreground">
          {progress.current}
        </div>
      )}

      {progress.errors.length > 0 && (
        <pre className="mt-1 max-h-[100px] overflow-auto rounded bg-background/50 p-2 font-mono text-xs text-destructive">
          {progress.errors.join('\n')}
        </pre>
      )}
    </div>
  )
}

function ResultBanner({
  ok,
  message,
  detail,
}: {
  ok: boolean
  message: string
  detail?: string
}) {
  return (
    <div
      className={`rounded-lg px-4 py-3 ${ok ? 'bg-success/10' : 'bg-destructive/10'}`}
    >
      <div className="flex items-center gap-2">
        {ok ? (
          <Check className="h-4 w-4 text-success" />
        ) : (
          <X className="h-4 w-4 text-destructive" />
        )}
        <span
          className={`text-sm font-medium ${ok ? 'text-success' : 'text-destructive'}`}
        >
          {message}
        </span>
      </div>
      {detail && (
        <pre className="mt-2 max-h-[200px] overflow-auto rounded bg-background/50 p-2 font-mono text-xs text-muted-foreground">
          {detail}
        </pre>
      )}
    </div>
  )
}
