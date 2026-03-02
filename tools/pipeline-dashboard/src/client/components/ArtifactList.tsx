import { useEffect, useState } from 'react'
import { File, Folder, FileQuestion } from 'lucide-react'
import type { ArtifactInfo } from '../lib/types'
import { fetchArtifacts } from '../lib/api'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString()
}

export function ArtifactList({ stageId }: { stageId: string }) {
  const [artifacts, setArtifacts] = useState<ArtifactInfo[]>([])

  useEffect(() => {
    fetchArtifacts(stageId).then((data) => setArtifacts(data.artifacts))
  }, [stageId])

  if (artifacts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">No artifacts defined</p>
    )
  }

  return (
    <div className="space-y-2">
      {artifacts.map((artifact) => (
        <div
          key={artifact.path}
          className="flex items-start gap-2 rounded-md border border-border bg-card/50 px-3 py-2"
        >
          {artifact.type === 'file' ? (
            <File size={14} className="mt-0.5 flex-shrink-0 text-status-success" />
          ) : artifact.type === 'directory' ? (
            <Folder size={14} className="mt-0.5 flex-shrink-0 text-status-running" />
          ) : (
            <FileQuestion
              size={14}
              className="mt-0.5 flex-shrink-0 text-muted-foreground"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-xs text-foreground">
              {artifact.path}
            </p>
            <p className="text-xs text-muted-foreground">
              {artifact.description}
            </p>
            {artifact.type === 'file' && artifact.size !== undefined && (
              <p className="text-xs text-muted-foreground/60">
                {formatBytes(artifact.size)}
                {artifact.modifiedAt &&
                  ` · ${formatTime(artifact.modifiedAt)}`}
              </p>
            )}
            {artifact.type === 'directory' && (
              <p className="text-xs text-muted-foreground/60">
                {artifact.fileCount} files
                {artifact.totalSize !== undefined &&
                  ` · ${formatBytes(artifact.totalSize)}`}
              </p>
            )}
            {artifact.type === 'missing' && (
              <p className="text-xs text-destructive/70">Not found</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
