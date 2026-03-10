function getWorkerUrl(): string {
  const url = process.env.__TEST_WORKER_URL
  if (!url) throw new Error('__TEST_WORKER_URL not set')
  return url
}

/** POST JSON with session cookie and matching Origin header. */
export async function authenticatedPost(
  path: string,
  body: unknown,
  cookie: string,
): Promise<Response> {
  const base = getWorkerUrl()
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      Origin: base,
    },
    body: JSON.stringify(body),
  })
}

/** POST JSON without authentication (for auth guard tests). */
export async function unauthenticatedPost(
  path: string,
  body: unknown,
): Promise<Response> {
  const base = getWorkerUrl()
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: base,
    },
    body: JSON.stringify(body),
  })
}

/** GET with session cookie. */
export async function authenticatedGet(
  path: string,
  cookie: string,
): Promise<Response> {
  const base = getWorkerUrl()
  return fetch(`${base}${path}`, {
    method: 'GET',
    headers: { Cookie: cookie },
    redirect: 'manual',
  })
}

/** GET without authentication (for redirect tests). */
export async function unauthenticatedGet(path: string): Promise<Response> {
  const base = getWorkerUrl()
  return fetch(`${base}${path}`, {
    method: 'GET',
    redirect: 'manual',
  })
}

/** POST with mismatched Origin header (for CSRF tests). */
export async function crossOriginPost(
  path: string,
  body: unknown,
  cookie: string,
): Promise<Response> {
  const base = getWorkerUrl()
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      Origin: 'https://evil.example.com',
    },
    body: JSON.stringify(body),
  })
}
