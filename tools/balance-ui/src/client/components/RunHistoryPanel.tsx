import { useState } from 'react'
import { Eye, GitCompareArrows, Pencil, Star, Trash2, X } from 'lucide-react'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Input } from './ui/input'
import { Card, CardContent } from './ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { BaselineDiffSummary } from './BaselineDiffSummary'
import type { ConstantsSnapshot, RunSummary } from '../../shared/types.ts'

const ROLE_COLOR_VALUES: Record<string, string> = {
  striker: 'oklch(0.65 0.2 25)',
  tank: 'oklch(0.65 0.15 245)',
  support: 'oklch(0.65 0.15 145)',
  bruiser: 'oklch(0.75 0.15 75)',
}

const ROLE_ORDER = ['striker', 'tank', 'support', 'bruiser']

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

interface Props {
  runs: Array<RunSummary>
  selectedIds: Array<string>
  constants?: ConstantsSnapshot | null
  onSelectToggle: (id: string) => void
  onDelete: (id: string) => Promise<void>
  onRename: (id: string, label: string) => Promise<void>
  onToggleStar: (id: string) => Promise<void>
  onViewRun: (id: string) => void
  onCompare: () => void
  onClearAll: () => Promise<void>
}

export function RunHistoryPanel({
  runs,
  selectedIds,
  constants,
  onSelectToggle,
  onDelete,
  onRename,
  onToggleStar,
  onViewRun,
  onCompare,
  onClearAll,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [sortBy, setSortBy] = useState<'date' | 'fitness'>('date')

  const sorted = [...runs].sort((a, b) =>
    sortBy === 'fitness'
      ? b.topFitness - a.topFitness
      : b.createdAt - a.createdAt,
  )

  function startEdit(run: RunSummary) {
    setEditingId(run.id)
    setEditValue(run.label)
  }

  function commitEdit() {
    if (editingId && editValue.trim()) {
      onRename(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  if (runs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No saved runs yet. Run a sim to get started.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">
                {selectedIds.length} selected
              </span>
              <Button
                variant="default"
                size="xs"
                onClick={onCompare}
                disabled={selectedIds.length < 2}
              >
                <GitCompareArrows size={12} />
                Compare
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border text-[10px]">
            <button
              onClick={() => setSortBy('date')}
              className={cn(
                'px-2 py-1 transition-colors',
                sortBy === 'date' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Date
            </button>
            <button
              onClick={() => setSortBy('fitness')}
              className={cn(
                'px-2 py-1 transition-colors',
                sortBy === 'fitness' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Fitness
            </button>
          </div>
          {confirmClearAll ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-destructive">Clear all?</span>
              <Button
                variant="destructive"
                size="xs"
                onClick={() => {
                  onClearAll()
                  setConfirmClearAll(false)
                }}
              >
                Yes
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setConfirmClearAll(false)}
              >
                No
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setConfirmClearAll(true)}
              className="text-muted-foreground"
            >
              <Trash2 size={10} />
              Clear All
            </Button>
          )}
        </div>
      </div>

      {/* Run list */}
      {sorted.map((run) => {
        const selected = selectedIds.includes(run.id)
        const isEditing = editingId === run.id
        const isConfirmingDelete = confirmDeleteId === run.id

        return (
          <Card
            key={run.id}
            className={cn(
              'transition-colors',
              selected && 'border-primary/40 bg-primary/5',
            )}
          >
            <CardContent className="flex items-start gap-3 p-3">
              {/* Select checkbox */}
              <div className="pt-0.5">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => onSelectToggle(run.id)}
                  className="accent-primary"
                />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                {/* Label row */}
                <div className="mb-1.5 flex items-center gap-2">
                  {isEditing ? (
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={commitEdit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitEdit()
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      className="h-5 w-48 text-xs px-1"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="cursor-pointer text-xs font-medium hover:text-primary transition-colors"
                      onClick={() => startEdit(run)}
                    >
                      {run.label}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(run.createdAt)}
                  </span>
                </div>

                {/* Config badges */}
                <div className="mb-2 flex flex-wrap gap-1">
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                    pop {run.population}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                    gen {run.generations}
                  </Badge>
                  {run.normalizeStats && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                      normalized
                    </Badge>
                  )}
                  {run.noActives && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                      no actives
                    </Badge>
                  )}
                  {run.noPassives && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                      no passives
                    </Badge>
                  )}
                  {run.patchCount > 0 && (
                    <Badge variant="default" className="text-[9px] px-1.5 py-0">
                      {run.patchCount} override{run.patchCount !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>

                {/* Baseline diff summary */}
                {run.patchCount > 0 && (
                  <BaselineDiffSummary
                    constants={run.config.constants}
                    creaturePatches={run.config.creaturePatches}
                    options={run.config.options}
                    activeTemplates={constants?.activeTemplates}
                    passiveTemplates={constants?.passiveTemplates}
                    compact
                    className="mb-2"
                  />
                )}

                {/* Stats row */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>
                      Top <span className="font-mono text-foreground">{(run.topFitness * 100).toFixed(1)}%</span>
                    </span>
                    <span>
                      Turns <span className="font-mono text-foreground">{run.avgTurns.toFixed(1)}</span>
                    </span>
                  </div>

                  {/* Mini role share bar */}
                  <MiniRoleBar roleShares={run.roleMetaShare} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onToggleStar(run.id)}
                    >
                      <Star
                        size={12}
                        className={cn(
                          run.starred
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-muted-foreground',
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{run.starred ? 'Unstar' : 'Star'}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => startEdit(run)}
                    >
                      <Pencil size={12} className="text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Rename</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => onViewRun(run.id)}
                    >
                      <Eye size={12} className="text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>View Results</TooltipContent>
                </Tooltip>

                {isConfirmingDelete ? (
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="destructive"
                      size="icon-xs"
                      onClick={() => {
                        onDelete(run.id)
                        setConfirmDeleteId(null)
                      }}
                    >
                      <Trash2 size={10} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setConfirmDeleteId(null)}
                    >
                      <X size={10} />
                    </Button>
                  </div>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setConfirmDeleteId(run.id)}
                      >
                        <Trash2 size={12} className="text-muted-foreground hover:text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function MiniRoleBar({ roleShares }: { roleShares: Record<string, number> }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-2 w-24 overflow-hidden rounded-full">
          {ROLE_ORDER.map((role) => {
            const share = roleShares[role] ?? 0
            return (
              <div
                key={role}
                style={{
                  width: `${share * 100}%`,
                  backgroundColor: ROLE_COLOR_VALUES[role],
                }}
              />
            )
          })}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {ROLE_ORDER.map((role) => (
          <div key={role} className="text-[10px]">
            <span className="capitalize">{role}</span>: {((roleShares[role] ?? 0) * 100).toFixed(1)}%
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}
