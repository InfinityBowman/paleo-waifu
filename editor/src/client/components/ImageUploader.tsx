import { useCallback, useRef, useState } from 'react'
import { Check, Cloud, ImagePlus, Loader2, Upload } from 'lucide-react'
import { pushImageToR2, uploadImage } from '../lib/api'
import { toCdnUrl } from '../lib/types'

export function ImageUploader({
  slug,
  currentImageUrl,
  onUploaded,
}: {
  slug: string | null
  currentImageUrl: string | null
  onUploaded: (result: { imageUrl: string; imageAspectRatio: number }) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    async (file: File) => {
      if (!slug) return
      setError(null)
      const objectUrl = URL.createObjectURL(file)
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return objectUrl
      })
      setUploading(true)

      try {
        const result = await uploadImage(slug, file)
        onUploaded(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed')
        URL.revokeObjectURL(objectUrl)
        setPreview(null)
      } finally {
        setUploading(false)
      }
    },
    [slug, onUploaded],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0] as File | undefined
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const imgSrc =
    preview || (slug && currentImageUrl ? toCdnUrl(currentImageUrl) : null)
  const disabled = !slug

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Image</label>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={disabled ? undefined : handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`relative flex min-h-[160px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors ${
          disabled
            ? 'cursor-not-allowed border-border/50 opacity-50'
            : dragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50'
        }`}
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt="Creature"
            className="max-h-[200px] object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 p-6 text-muted-foreground">
            <ImagePlus className="h-8 w-8" />
            <span className="text-sm">
              {disabled
                ? 'Save creature first to upload an image'
                : 'Drop an image or click to upload'}
            </span>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading to R2...
            </div>
          </div>
        )}
      </div>

      {!disabled && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!disabled && imgSrc && !uploading && (
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => {
              e.stopPropagation()
              inputRef.current?.click()
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <Upload className="h-3 w-3" />
            Replace image
          </button>
          <PushToR2Button slug={slug} />
        </div>
      )}
    </div>
  )
}

function PushToR2Button({ slug }: { slug: string }) {
  const [state, setState] = useState<'idle' | 'pushing' | 'done' | 'error'>(
    'idle',
  )
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handlePush() {
    setState('pushing')
    setErrorMsg(null)
    try {
      await pushImageToR2(slug)
      setState('done')
      setTimeout(() => setState('idle'), 3000)
    } catch (err) {
      setState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Push failed')
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={(e) => {
          e.stopPropagation()
          handlePush()
        }}
        disabled={state === 'pushing'}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        {state === 'pushing' ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : state === 'done' ? (
          <Check className="h-3 w-3 text-success" />
        ) : (
          <Cloud className="h-3 w-3" />
        )}
        {state === 'done' ? 'Pushed' : 'Push to R2'}
      </button>
      {state === 'error' && errorMsg && (
        <span className="text-xs text-destructive">{errorMsg}</span>
      )}
    </div>
  )
}
