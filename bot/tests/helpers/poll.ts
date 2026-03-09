/**
 * Poll a condition until it returns truthy, with a timeout.
 * Used for asserting deferred command side-effects in D1.
 */
export async function pollUntil<T>(
  fn: () => Promise<T>,
  options?: { intervalMs?: number; timeoutMs?: number },
): Promise<T> {
  const interval = options?.intervalMs ?? 200
  const timeout = options?.timeoutMs ?? 5000
  const start = Date.now()

  while (Date.now() - start < timeout) {
    const result = await fn()
    if (result) return result
    await new Promise((r) => setTimeout(r, interval))
  }

  throw new Error(`pollUntil timed out after ${timeout}ms`)
}
