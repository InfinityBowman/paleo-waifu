/**
 * D1 REST API shim — implements the D1Database/D1PreparedStatement interface
 * so drizzle-orm/d1 works from Node.js (outside Cloudflare Workers).
 *
 * Uses https://api.cloudflare.com/client/v4/accounts/{id}/d1/database/{id}/query
 */

const CF_API = 'https://api.cloudflare.com/client/v4'

interface D1ShimConfig {
  accountId: string
  databaseId: string
  token: string
}

interface D1RawResult {
  results: Array<Record<string, unknown>>
  meta: { changes: number; last_row_id: number; duration: number }
  success: boolean
}

function queryUrl(config: D1ShimConfig): string {
  return `${CF_API}/accounts/${config.accountId}/d1/database/${config.databaseId}/query`
}

function authHeaders(config: D1ShimConfig): Record<string, string> {
  return {
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json',
  }
}

async function queryD1(
  config: D1ShimConfig,
  sql: string,
  params: Array<unknown>,
): Promise<D1RawResult> {
  const res = await fetch(queryUrl(config), {
    method: 'POST',
    headers: authHeaders(config),
    body: JSON.stringify({ sql, params }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`D1 API error ${res.status}: ${text}`)
  }

  const body = (await res.json()) as {
    result: Array<D1RawResult>
    success: boolean
    errors: Array<{ message: string }>
  }
  if (!body.success) {
    throw new Error(
      `D1 query failed: ${body.errors.map((e) => e.message).join(', ')}`,
    )
  }

  return body.result[0]
}

class D1PreparedStatementShim {
  params: Array<unknown> = []
  constructor(
    private config: D1ShimConfig,
    readonly sql: string,
  ) {}

  bind(...values: Array<unknown>): D1PreparedStatementShim {
    const bound = new D1PreparedStatementShim(this.config, this.sql)
    bound.params = values
    return bound
  }

  async run(): Promise<{
    results: Array<Record<string, unknown>>
    success: boolean
    meta: { changes: number; last_row_id: number; duration: number }
  }> {
    const r = await queryD1(this.config, this.sql, this.params)
    return { results: r.results, success: r.success, meta: r.meta }
  }

  async all(): Promise<{ results: Array<Record<string, unknown>> }> {
    const r = await queryD1(this.config, this.sql, this.params)
    return { results: r.results }
  }

  async raw(): Promise<Array<Array<unknown>>> {
    const r = await queryD1(this.config, this.sql, this.params)
    return r.results.map((row) => Object.values(row))
  }

  async first(col?: string): Promise<unknown> {
    const r = await queryD1(this.config, this.sql, this.params)
    if (!r.results.length) return null
    if (col) return r.results[0][col]
    return r.results[0]
  }
}

export class D1DatabaseShim {
  constructor(private config: D1ShimConfig) {}

  prepare(sql: string): D1PreparedStatementShim {
    return new D1PreparedStatementShim(this.config, sql)
  }

  async batch(
    stmts: Array<D1PreparedStatementShim>,
  ): Promise<Array<D1RawResult>> {
    // D1 REST API accepts an array of statements for atomic batch execution
    const res = await fetch(queryUrl(this.config), {
      method: 'POST',
      headers: authHeaders(this.config),
      body: JSON.stringify(
        stmts.map((s) => ({ sql: s.sql, params: s.params })),
      ),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`D1 batch API error ${res.status}: ${text}`)
    }

    const body = (await res.json()) as {
      result: Array<D1RawResult>
      success: boolean
      errors: Array<{ message: string }>
    }
    if (!body.success) {
      throw new Error(
        `D1 batch failed: ${body.errors.map((e) => e.message).join(', ')}`,
      )
    }

    return body.result
  }

  async exec(sql: string): Promise<{ count: number; duration: number }> {
    const r = await queryD1(this.config, sql, [])
    return { count: r.meta.changes, duration: r.meta.duration }
  }

  dump(): Promise<ArrayBuffer> {
    throw new Error('dump() not supported via REST API')
  }
}
