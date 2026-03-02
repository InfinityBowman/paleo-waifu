export type StageStatus = 'idle' | 'running' | 'success' | 'failed'

export interface StageArg {
  name: string
  flag: string
  type: 'number' | 'boolean'
  description: string
  default?: number | boolean
}

export interface ArtifactSpec {
  path: string
  description: string
  glob?: string
}

export interface StageDefinition {
  id: string
  name: string
  description: string
  details: string[]
  command: string
  args: string[]
  cwd: string
  dependsOn: string[]
  userArgs: StageArg[]
  artifacts: ArtifactSpec[]
  estimatedDuration: string
}

export interface StageState {
  status: StageStatus
  startedAt?: number
  finishedAt?: number
  exitCode?: number | null
  pid?: number
  error?: string
}

export interface StageWithState extends StageDefinition {
  state: StageState
}

export interface OutputLine {
  type: 'stdout' | 'stderr'
  line: string
  ts: number
}

export interface ArtifactInfo {
  path: string
  description: string
  type: 'file' | 'directory' | 'missing'
  size?: number
  totalSize?: number
  fileCount?: number
  modifiedAt?: number
}
