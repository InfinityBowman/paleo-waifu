export const AVG_TURNS_TARGET_MIN = 7
export const AVG_TURNS_TARGET_MAX = 10

export const ROLE_ORDER = ['striker', 'tank', 'support', 'bruiser']

export const ROLE_COLORS: Record<string, string> = {
  striker: 'bg-role-striker',
  tank: 'bg-role-tank',
  support: 'bg-role-support',
  bruiser: 'bg-role-bruiser',
}

export const ROLE_COLOR_VALUES: Record<string, string> = {
  striker: 'oklch(0.65 0.2 25)',
  tank: 'oklch(0.65 0.15 245)',
  support: 'oklch(0.65 0.15 145)',
  bruiser: 'oklch(0.75 0.15 75)',
}

export const FORMATION_COLORS = [
  'oklch(0.65 0.15 340)',
  'oklch(0.65 0.15 245)',
  'oklch(0.65 0.15 145)',
  'oklch(0.75 0.15 75)',
  'oklch(0.7 0.17 300)',
  'oklch(0.7 0.1 200)',
]

export const TOOLTIP_CONTENT_STYLE = {
  background: 'oklch(0.15 0.025 290)',
  border: '1px solid oklch(1 0 0 / 8%)',
  borderRadius: 8,
  fontSize: 12,
}

export const TOOLTIP_ITEM_STYLE = { color: 'oklch(0.9 0.02 290)' }
export const TOOLTIP_LABEL_STYLE = { color: 'oklch(0.9 0.02 290)' }

export function entries(obj: Record<string, number>): Array<[string, number]> {
  return Object.entries(obj)
}

export function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`
}
