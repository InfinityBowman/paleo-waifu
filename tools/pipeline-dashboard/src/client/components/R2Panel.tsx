import { useState } from 'react'
import {
  Check,
  Cloud,
  Loader2,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { deleteOrphan, listOrphans, syncR2 } from '../lib/api'
import type { SyncProgress } from '../lib/api'

export function R2Panel({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [orphans, setOrphans] = useState<Array<string> | null>(null)
  const [scanning, setScanning] = useState(false)
  const [deleting, setDeleting] = useState<Set<string>>(new Set())
  const [deleted, setDeleted] = useState<Set<string>>(new Set())
  const [errors, setErrors] = useState<Map<string, string>>(new Map())

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

  async function handleScan() {
    setScanning(true)
    setOrphans(null)
    setDeleted(new Set())
    setErrors(new Map())

    try {
      const result = await listOrphans()
      setOrphans(result)
    } catch (err) {
      setOrphans([])
      setErrors(
        new Map([
          ['_scan', err instanceof Error ? err.message : 'Scan failed'],
        ]),
      )
    } finally {
      setScanning(false)
    }
  }

  async function handleDelete(key: string) {
    setDeleting((prev) => new Set(prev).add(key))
    setErrors((prev) => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })

    try {
      await deleteOrphan(key)
      setDeleted((prev) => new Set(prev).add(key))
    } catch (err) {
      setErrors((prev) =>
        new Map(prev).set(
          key,
          err instanceof Error ? err.message : 'Delete failed',
        ),
      )
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }

  const activeOrphans = orphans?.filter((k) => !deleted.has(k)) ?? []
  const isBusy = busy || scanning || deleting.size > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-140 rounded-xl bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              R2 Image Management
            </span>
          </div>
          <button
            onClick={onClose}
            disabled={isBusy}
            className="rounded-lg p-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <p className="text-sm text-muted-foreground">
            Upload all local images to production R2 with proper cache headers,
            or scan for orphaned objects and delete them individually.
          </p>

          <div className="flex gap-3">
            <button
              onClick={handleSync}
              disabled={isBusy}
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
              onClick={handleScan}
              disabled={isBusy}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg border-2 border-border px-4 py-3 text-sm font-medium transition-colors hover:border-warning hover:bg-warning/5 disabled:opacity-50"
            >
              {scanning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              <div>
                <div className="font-medium">Scan Orphaned</div>
                <div className="mt-0.5 text-xs opacity-70">
                  Find stale objects
                </div>
              </div>
            </button>
          </div>

          {syncProgress && <SyncProgressBar progress={syncProgress} />}

          {errors.has('_scan') && (
            <ResultBanner ok={false} message={errors.get('_scan')!} />
          )}

          {orphans !== null && !errors.has('_scan') && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  {activeOrphans.length === 0
                    ? 'No orphaned objects found'
                    : `${activeOrphans.length} orphaned object${activeOrphans.length === 1 ? '' : 's'}`}
                </span>
                {deleted.size > 0 && (
                  <span className="text-xs text-success">
                    {deleted.size} deleted
                  </span>
                )}
              </div>

              {activeOrphans.length > 0 && (
                <div className="max-h-60 space-y-1 overflow-auto rounded-lg bg-muted/50 p-2">
                  {activeOrphans.map((key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-md px-3 py-2 text-sm hover:bg-background/50"
                    >
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {key}
                      </span>
                      <button
                        onClick={() => handleDelete(key)}
                        disabled={deleting.has(key)}
                        className="ml-3 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                        title={`Delete ${key}`}
                      >
                        {deleting.has(key) ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {errors.has(key) && (
                        <span className="ml-2 text-xs text-destructive">
                          {errors.get(key)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            disabled={isBusy}
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
        <pre className="mt-1 max-h-25 overflow-auto rounded bg-background/50 p-2 font-mono text-xs text-destructive">
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
        <pre className="mt-2 max-h-50 overflow-auto rounded bg-background/50 p-2 font-mono text-xs text-muted-foreground">
          {detail}
        </pre>
      )}
    </div>
  )
}
