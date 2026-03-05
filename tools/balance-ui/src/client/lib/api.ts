import type {
  CreaturesResponse,
  SimProgressEvent,
  SimRequest,
} from '../../shared/types.ts'

export async function fetchCreatures(): Promise<CreaturesResponse> {
  const res = await fetch('/api/creatures')
  return res.json()
}

export async function reloadCreatures(): Promise<CreaturesResponse> {
  const res = await fetch('/api/creatures/reload')
  return res.json()
}

export async function runSim(
  request: SimRequest,
  onProgress: (event: SimProgressEvent) => void,
): Promise<void> {
  const res = await fetch('/api/sim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.error ?? 'Sim failed')
  }

  if (!res.body) throw new Error('No response body')
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()!

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6)) as SimProgressEvent
        onProgress(data)
      }
    }
  }
}
