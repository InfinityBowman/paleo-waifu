import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'

// Test-only DB endpoints — only available in dev builds.
// In production, Vite replaces import.meta.env.DEV with false
// and tree-shakes the handler body entirely.

const notFound = () => new Response('Not Found', { status: 404 })

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

export const Route = createFileRoute('/api/test')({
  server: {
    handlers: {
      POST: import.meta.env.DEV
        ? async ({ request }) => {
            const url = new URL(request.url)
            const action = url.searchParams.get('action')

            if (!action || !['query', 'execute', 'batch'].includes(action)) {
              return json({ error: 'Missing or invalid ?action= param' }, 400)
            }

            const db = env.DB

            // Batch: multiple statements
            if (action === 'batch') {
              const body: {
                statements: Array<{ sql: string; params?: Array<unknown> }>
              } = await request.json()
              const stmts = body.statements.map((s) => {
                const st = db.prepare(s.sql)
                return s.params?.length ? st.bind(...s.params) : st
              })
              await db.batch(stmts)
              return json({ success: true })
            }

            // Single statement
            const body: { sql: string; params?: Array<unknown> } =
              await request.json()
            if (!body.sql) {
              return json({ error: 'Missing sql' }, 400)
            }

            const stmt = db.prepare(body.sql)
            const bound = body.params?.length
              ? stmt.bind(...body.params)
              : stmt

            if (action === 'query') {
              const result = await bound.all()
              return json({ rows: result.results })
            }

            // action === 'execute'
            await bound.run()
            return json({ success: true })
          }
        : notFound,
    },
  },
})
