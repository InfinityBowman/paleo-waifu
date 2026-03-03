export interface Creature {
  name: string
  scientificName: string
  era: string
  period: string | null
  diet: string
  sizeMeters: number | null
  weightKg: number | null
  rarity: Rarity
  description: string
  funFacts: Array<string>
  wikipediaImageUrl: string | null
  source: string
  type: string
  foundIn: string | null
  nameMeaning: string | null
  pronunciation: string | null
  imageAspectRatio: number | null
  imageUrl: string | null
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export interface Stats {
  total: number
  byRarity: Record<string, number>
  byEra: Record<string, number>
  byDiet: Record<string, number>
  byType: Record<string, number>
  missingImages: number
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
