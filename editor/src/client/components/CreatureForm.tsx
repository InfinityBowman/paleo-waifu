import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import {
  createCreature,
  deleteCreature,
  fetchCreature,
  updateCreature,
} from '../lib/api'
import {   slugify } from '../lib/types'
import { RarityBadge } from './RarityBadge'
import { ImageUploader } from './ImageUploader'
import type {Creature, Rarity} from '../lib/types';

const RARITIES: Array<Rarity> = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const ERAS = [
  'Cambrian',
  'Ordovician',
  'Silurian',
  'Devonian',
  'Carboniferous',
  'Permian',
  'Triassic',
  'Jurassic',
  'Cretaceous',
  'Paleogene',
  'Neogene',
  'Quaternary',
]
const DIETS = [
  'Herbivorous',
  'Carnivorous',
  'Omnivorous',
  'Piscivorous',
  'Insectivorous',
  'Filter feeder',
]

const EMPTY: Creature = {
  name: '',
  scientificName: '',
  era: 'Cretaceous',
  period: null,
  diet: 'Herbivorous',
  sizeMeters: null,
  weightKg: null,
  rarity: 'common',
  description: '',
  funFacts: [],
  wikipediaImageUrl: null,
  source: 'manual',
  type: '',
  foundIn: null,
  nameMeaning: null,
  pronunciation: null,
  imageAspectRatio: null,
  imageUrl: null,
}

export function CreatureForm({
  slug,
  onBack,
  onSaved,
  onDeleted,
}: {
  slug: string | null
  onBack: () => void
  onSaved: () => void
  onDeleted: () => void
}) {
  const isCreate = slug === null
  const [form, setForm] = useState<Creature>(EMPTY)
  const [loading, setLoading] = useState(!isCreate)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    fetchCreature(slug)
      .then(({ creature }) => setForm(creature))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  const set = useCallback(
    <TKey extends keyof Creature>(key: TKey, value: Creature[TKey]) => {
      setForm((prev) => ({ ...prev, [key]: value }))
    },
    [],
  )

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      if (isCreate) {
        await createCreature(form)
      } else {
        await updateCreature(slug, form)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!slug) return
    try {
      await deleteCreature(slug, true)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const currentSlug = form.scientificName ? slugify(form.scientificName) : null

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="flex items-center gap-3 border-b border-border px-6 py-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <h2 className="text-lg font-semibold text-foreground">
          {isCreate ? 'Add Creature' : form.name || 'Edit Creature'}
        </h2>
        {!isCreate && <RarityBadge rarity={form.rarity} />}
        <div className="ml-auto flex items-center gap-3">
          {!isCreate && (
            <button
              onClick={() => setShowDelete(true)}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !form.name || !form.scientificName}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isCreate ? 'Create' : 'Save'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid flex-1 grid-cols-[1fr_320px] gap-6 p-6">
        {/* Left: Fields */}
        <div className="space-y-6">
          {/* Identity */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Identity
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Name"
                value={form.name}
                onChange={(v) => set('name', v)}
                required
              />
              <Field
                label="Scientific Name"
                value={form.scientificName}
                onChange={(v) => set('scientificName', v)}
                required
              />
              <Field
                label="Pronunciation"
                value={form.pronunciation ?? ''}
                onChange={(v) => set('pronunciation', v || null)}
              />
              <Field
                label="Name Meaning"
                value={form.nameMeaning ?? ''}
                onChange={(v) => set('nameMeaning', v || null)}
              />
            </div>
          </fieldset>

          {/* Classification */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Classification
            </legend>
            <div className="grid grid-cols-2 gap-3">
              <SelectField
                label="Era"
                value={form.era}
                onChange={(v) => set('era', v)}
                options={ERAS}
              />
              <Field
                label="Period"
                value={form.period ?? ''}
                onChange={(v) => set('period', v || null)}
                placeholder="e.g. Late Cretaceous"
              />
              <SelectField
                label="Diet"
                value={form.diet}
                onChange={(v) => set('diet', v)}
                options={DIETS}
              />
              <Field
                label="Type"
                value={form.type}
                onChange={(v) => set('type', v)}
                placeholder="e.g. theropod, sauropod"
              />
              <Field
                label="Source"
                value={form.source}
                onChange={(v) => set('source', v)}
              />
              <Field
                label="Found In"
                value={form.foundIn ?? ''}
                onChange={(v) => set('foundIn', v || null)}
              />
            </div>
          </fieldset>

          {/* Stats */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Stats
            </legend>
            <div className="grid grid-cols-3 gap-3">
              <SelectField
                label="Rarity"
                value={form.rarity}
                onChange={(v) => set('rarity', v as Rarity)}
                options={RARITIES}
              />
              <NumberField
                label="Size (meters)"
                value={form.sizeMeters}
                onChange={(v) => set('sizeMeters', v)}
              />
              <NumberField
                label="Weight (kg)"
                value={form.weightKg}
                onChange={(v) => set('weightKg', v)}
              />
            </div>
          </fieldset>

          {/* Content */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Content
            </legend>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <FunFactsEditor
              facts={form.funFacts}
              onChange={(v) => set('funFacts', v)}
            />
          </fieldset>

          {/* Reference */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Reference
            </legend>
            <Field
              label="Wikipedia Image URL"
              value={form.wikipediaImageUrl ?? ''}
              onChange={(v) => set('wikipediaImageUrl', v || null)}
              placeholder="https://upload.wikimedia.org/..."
            />
            {form.imageUrl && (
              <div className="text-sm text-muted-foreground">
                Image URL: <code className="text-xs">{form.imageUrl}</code>
              </div>
            )}
            {form.imageAspectRatio && (
              <div className="text-sm text-muted-foreground">
                Aspect ratio: {form.imageAspectRatio}
              </div>
            )}
          </fieldset>
        </div>

        {/* Right: Image */}
        <div>
          <ImageUploader
            slug={isCreate ? null : currentSlug}
            currentImageUrl={form.imageUrl}
            onUploaded={(result) => {
              set('imageUrl', result.imageUrl)
              set('imageAspectRatio', result.imageAspectRatio)
            }}
          />
        </div>
      </div>

      {/* Delete confirmation */}
      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-[400px] rounded-xl bg-card p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">
              Delete {form.name}?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              This will remove the creature from the JSON file and delete its
              image from R2. This action cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowDelete(false)}
                className="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-destructive px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Field primitives ────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  required,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: Array<string>
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground capitalize focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o.charAt(0).toUpperCase() + o.slice(1)}
          </option>
        ))}
      </select>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <input
        type="number"
        step="any"
        value={value ?? ''}
        onChange={(e) =>
          onChange(e.target.value === '' ? null : Number(e.target.value))
        }
        className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
    </div>
  )
}

function FunFactsEditor({
  facts,
  onChange,
}: {
  facts: Array<string>
  onChange: (v: Array<string>) => void
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground">Fun Facts</label>
      {facts.map((fact, i) => (
        <div key={i} className="flex gap-2">
          <input
            type="text"
            value={fact}
            onChange={(e) => {
              const next = [...facts]
              next[i] = e.target.value
              onChange(next)
            }}
            className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => onChange(facts.filter((_, j) => j !== i))}
            className="h-9 rounded-lg px-2 text-sm text-destructive hover:bg-destructive/10"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...facts, ''])}
        className="text-sm text-primary hover:underline"
      >
        + Add fun fact
      </button>
    </div>
  )
}
