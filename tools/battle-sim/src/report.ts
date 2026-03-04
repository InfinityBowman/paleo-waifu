import chalk from 'chalk'
import Table from 'cli-table3'
import cliProgress from 'cli-progress'

// ─── Headers ──────────────────────────────────────────────────────

export function printHeader(title: string): void {
  console.log()
  console.log(chalk.bold.cyan(`=== ${title} ===`))
  console.log()
}

export function printSubheader(text: string): void {
  console.log(chalk.dim(`── ${text} ──`))
  console.log()
}

// ─── Tables ───────────────────────────────────────────────────────

export function printTable(
  rowHeaders: string[],
  colHeaders: string[],
  cells: string[][],
  options?: { title?: string },
): void {
  if (options?.title) {
    console.log(chalk.bold(options.title))
  }

  const table = new Table({
    head: ['', ...colHeaders],
    style: { head: ['cyan'] },
  })

  for (let i = 0; i < rowHeaders.length; i++) {
    table.push({ [rowHeaders[i]]: cells[i] ?? [] })
  }

  console.log(table.toString())
  console.log()
}

export function printRankedList(
  columns: Array<{ header: string; width?: number }>,
  rows: string[][],
  options?: { title?: string },
): void {
  if (options?.title) {
    console.log(chalk.bold(options.title))
  }

  const table = new Table({
    head: ['#', ...columns.map((c) => c.header)],
    style: { head: ['cyan'] },
  })

  for (let i = 0; i < rows.length; i++) {
    table.push([String(i + 1), ...(rows[i] ?? [])])
  }

  console.log(table.toString())
  console.log()
}

// ─── Stat Block ───────────────────────────────────────────────────

export function printStatBlock(stats: Record<string, string | number>): void {
  const table = new Table({
    style: { head: [] },
  })

  for (const [key, value] of Object.entries(stats)) {
    table.push({ [chalk.bold(key)]: String(value) })
  }

  console.log(table.toString())
  console.log()
}

// ─── Progress Bar ─────────────────────────────────────────────────

export interface ProgressBarHandle {
  increment(): void
  stop(): void
}

export function createProgressBar(
  total: number,
  label: string,
): ProgressBarHandle {
  const bar = new cliProgress.SingleBar(
    {
      format: `  ${label} |${chalk.cyan('{bar}')}| {percentage}% | {value}/{total}`,
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  )

  bar.start(total, 0)

  return {
    increment() {
      bar.increment()
    },
    stop() {
      bar.stop()
    },
  }
}

// ─── CSV Output ───────────────────────────────────────────────────

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function writeCsvRow(values: (string | number)[]): void {
  console.log(values.map((v) => escapeCsv(String(v))).join(','))
}

export function writeCsvHeader(headers: string[]): void {
  writeCsvRow(headers)
}

// ─── Color Helpers ────────────────────────────────────────────────

export function winRateColor(rate: number): string {
  const pct = `${(rate * 100).toFixed(1)}%`
  if (rate > 0.55) return chalk.green(pct)
  if (rate < 0.45) return chalk.red(pct)
  return chalk.yellow(pct)
}

export function rarityColor(rarity: string): string {
  switch (rarity) {
    case 'legendary':
      return chalk.yellow(rarity)
    case 'epic':
      return chalk.magenta(rarity)
    case 'rare':
      return chalk.cyan(rarity)
    case 'uncommon':
      return chalk.green(rarity)
    default:
      return chalk.white(rarity)
  }
}

export function roleColor(role: string): string {
  switch (role) {
    case 'striker':
      return chalk.red(role)
    case 'tank':
      return chalk.blue(role)
    case 'scout':
      return chalk.green(role)
    case 'support':
      return chalk.yellow(role)
    case 'bruiser':
      return chalk.magenta(role)
    case 'specialist':
      return chalk.cyan(role)
    default:
      return role
  }
}
