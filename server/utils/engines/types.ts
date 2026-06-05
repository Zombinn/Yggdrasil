/** 引擎类型标识 */
export type EngineId = 'hermes' | 'openclaw' | 'claude-code'

/** Kanban 活跃任务 */
export interface KanbanTask {
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

/** 引擎检测状态 */
export interface EngineDetection {
  id: EngineId
  name: string
  available: boolean
  version: string | null
  path: string | null
  error?: string
}

/** 引擎发现的 Profile */
export interface EngineProfile {
  slug: string
  displayName: string | null
  engine: EngineId
  isDefault: boolean
  hermesDir: string
}

/** 引擎抽象接口 */
export interface EngineAdapter {
  id: EngineId
  name: string

  /** 检测引擎是否可用 */
  detect(): Promise<EngineDetection>

  /** 发现所有可用的 Profile */
  discoverProfiles(): Promise<EngineProfile[]>

  /** 读取 Kanban 任务（如果支持） */
  readKanban?(assignee?: string): KanbanTask[]

  /** 检查 dispatcher 是否正常 */
  isDispatcherStale?(): boolean
}
