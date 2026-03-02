import type { StageWithState, ArtifactInfo, OutputLine } from './types'

export async function fetchPipeline(): Promise<{ stages: StageWithState[] }> {
  const res = await fetch('/api/pipeline')
  return res.json()
}

export async function runStage(
  id: string,
  args?: Record<string, unknown>,
): Promise<void> {
  await fetch(`/api/stages/${id}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ args: args ?? {} }),
  })
}

export async function stopStage(id: string): Promise<void> {
  await fetch(`/api/stages/${id}/stop`, { method: 'POST' })
}

export async function runPipeline(
  fromStage?: string,
  argsMap?: Record<string, Record<string, unknown>>,
): Promise<void> {
  await fetch('/api/pipeline/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fromStage, argsMap }),
  })
}

export async function resetPipeline(): Promise<void> {
  await fetch('/api/pipeline/reset', { method: 'POST' })
}

export async function stopAllStages(): Promise<void> {
  await fetch('/api/pipeline/stop', { method: 'POST' })
}

export async function fetchArtifacts(
  id: string,
): Promise<{ artifacts: ArtifactInfo[] }> {
  const res = await fetch(`/api/stages/${id}/artifacts`)
  return res.json()
}

export async function fetchOutputBuffer(
  id: string,
): Promise<OutputLine[]> {
  const res = await fetch(`/api/stages/${id}/output/buffer`)
  const data = await res.json()
  return (data.lines ?? []).map((l: { type: string; line: string }) => ({
    type: l.type,
    line: l.line,
    ts: Date.now(),
  }))
}

export function outputStreamUrl(id: string): string {
  return `/api/stages/${id}/output`
}
