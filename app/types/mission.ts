export interface CurrentTask {
  id: string
  title: string
  body: string | null
  assignee: string | null
  status: string
  priority: number
  workerPid: number | null
  startedAt: number | null
  claimExpires: number | null
  lastHeartbeatAt: number | null
  createdAt: number
  parentIds: string[]
}
export interface Mission {
  id: string
  orchestratorSlug: string
  title: string | null
  status: string
  createdAt: string
  lastMessageAt: string
}
export interface MissionMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  pending?: boolean
}
export interface MissionEvent {
  type: string
  delta?: string
  messageId?: number
  content?: string
  title?: string
  message?: string
}
export interface ThoughtStep {
  kind: 'tool' | 'thought'
  label: string
  ts: number
}
