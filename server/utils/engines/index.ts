import type { EngineId, EngineDetection, EngineProfile, KanbanTask } from './types'
import type { EngineAdapter } from './types'
import { hermesAdapter, openclawAdapter, claudeCodeAdapter } from './hermes'
import { listActiveTasks, dispatcherLikelyStale } from './kanban'
import { useDb } from '../db'

const ALL_ADAPTERS: EngineAdapter[] = [hermesAdapter, openclawAdapter, claudeCodeAdapter]

// 引擎检测依赖同步 execSync（which / --version / npx），单次约 0.6s 且结果短期不变。
// 用 TTL 内存缓存 + 在途去重，避免每次切页面都重跑，消除导航卡顿。
const DETECT_TTL_MS = 30_000
let detectCache: { at: number; data: EngineDetection[] } | null = null
let detectInflight: Promise<EngineDetection[]> | null = null

/** 检测所有引擎的可用性（带 TTL 缓存 + 在途去重 + 并行探测） */
export async function detectEngines(): Promise<EngineDetection[]> {
  if (detectCache && Date.now() - detectCache.at < DETECT_TTL_MS) return detectCache.data
  if (detectInflight) return detectInflight

  detectInflight = (async () => {
    const results = await Promise.all(ALL_ADAPTERS.map(async (adapter): Promise<EngineDetection> => {
      try {
        return await adapter.detect()
      } catch (e: any) {
        return { id: adapter.id, name: adapter.name, available: false, version: null, path: null, error: e.message }
      }
    }))
    detectCache = { at: Date.now(), data: results }
    return results
  })()

  try { return await detectInflight } finally { detectInflight = null }
}

/** 从所有可用引擎发现 Profiles（复用 detectEngines 的缓存判断可用性） */
export async function discoverAllProfiles(): Promise<EngineProfile[]> {
  const detections = await detectEngines()
  const availability = new Map(detections.map(d => [d.id, d.available]))
  const all: EngineProfile[] = []
  for (const adapter of ALL_ADAPTERS) {
    if (!availability.get(adapter.id)) continue
    try {
      all.push(...await adapter.discoverProfiles())
    } catch {}
  }
  return all
}

/** 读取 Kanban（仅 Hermes 支持） */
export function readKanbanTasks(engineFilter?: EngineId, assignee?: string): KanbanTask[] {
  if (!engineFilter || engineFilter === 'hermes') return listActiveTasks(assignee)
  return []
}

export function isDispatcherStale(): boolean { return dispatcherLikelyStale() }

export function setDefaultEngine(engine: EngineId): void {
  const db = useDb()
  db.prepare('UPDATE profiles SET engine = ? WHERE is_default = 1').run(engine)
}

export function getDefaultEngine(): EngineId {
  const db = useDb()
  const row = db.prepare("SELECT engine FROM profiles WHERE is_default = 1 AND present = 1").get() as any
  return (row?.engine as EngineId) || 'hermes'
}

export function setProfileEngine(slug: string, engine: EngineId): void {
  const db = useDb()
  db.prepare('UPDATE profiles SET engine = ? WHERE slug = ?').run(engine, slug)
}
