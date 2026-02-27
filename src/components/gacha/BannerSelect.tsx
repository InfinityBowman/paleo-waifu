import { cn } from '@/lib/utils'

interface Banner {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
}

export function BannerSelect({
  banners,
  selectedId,
  onSelect,
}: {
  banners: Banner[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-3 overflow-x-auto pb-2">
        {banners.map((b) => (
          <button
            key={b.id}
            onClick={() => onSelect(b.id)}
            className={cn(
              'flex-shrink-0 rounded-lg border p-4 text-left transition-all',
              selectedId === b.id
                ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
                : 'hover:border-muted-foreground/30',
            )}
          >
            <div className="font-semibold">{b.name}</div>
            {b.description && (
              <div className="mt-1 text-sm text-muted-foreground">
                {b.description}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
