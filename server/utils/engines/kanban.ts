import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { KanbanTask } from './types'

const dbPath = join(process.env.HERMES_HOME || join(homedir(), '.hermes'), 'kanban.db')
let cached: DatabaseSync | null = null

function getDb(): DatabaseSync | null {
  if (cached) return cached
  if (!existsSync(dbPath)) return null
  return (cached = new DatabaseSync(dbPath, { readOnly: true }))
}

const ACTIVE = ['running','ready','todo','blocked','triage'] as const

export function listActiveTasks(assignee?: string): KanbanTask[] {
  const db = getDb(); if (!db) return []
  const ph = ACTIVE.map(() => '?').join(',')
  const params: unknown[] = [...ACTIVE]
  let where = 'status IN (' + ph + ')'
  if (assignee) { where += ' AND assignee = ?'; params.push(assignee) }
  const rows = db.prepare('SELECT id,title,body,assignee,status,priority,worker_pid,started_at,claim_expires,last_heartbeat_at,created_at FROM tasks WHERE ' + where + " ORDER BY CASE status WHEN 'running' THEN 0 WHEN 'blocked' THEN 1 WHEN 'ready' THEN 2 WHEN 'todo' THEN 3 WHEN 'triage' THEN 4 ELSE 5 END, priority DESC, created_at ASC").all(...(params as any)) as any[]
  const tasks = rows.map(r => ({
    id: r.id, title: r.title, body: r.body, assignee: r.assignee, status: r.status,
    priority: r.priority, workerPid: r.worker_pid, startedAt: r.started_at,
    claimExpires: r.claim_expires, lastHeartbeatAt: r.last_heartbeat_at,
    createdAt: r.created_at, parentIds: [] as string[]
  }))
  if (tasks.length > 0) {
    const ids = tasks.map(t => t.id)
    const links = db.prepare('SELECT parent_id, child_id FROM task_links WHERE child_id IN (' + ids.map(() => '?').join(',') + ')').all(...ids) as any[]
    const byChild = new Map<string, string[]>()
    for (const l of links) {
      const arr = byChild.get(l.child_id) || []; arr.push(l.parent_id); byChild.set(l.child_id, arr)
    }
    for (const t of tasks) { const p = byChild.get(t.id); if (p) t.parentIds = p }
  }
  return tasks
}

export function dispatcherLikelyStale(): boolean {
  const db = getDb(); if (!db) return false
  const cutoff = Math.floor(Date.now() / 1000) - 300
  const row = db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status='ready' AND created_at < ?").get(cutoff) as any
  return (row?.count ?? 0) > 0
}

// ── 写操作 ──────────────────────────────────────────
// 说明：直接写 Hermes 的 kanban.db，列名/语义沿用上面的读路径所反映的 schema
// （tasks: id,title,body,assignee,status,priority,created_at 等；created_at 为 unix 秒）。
// 需要 Hermes 已初始化（kanban.db 存在）才可用，否则 kanbanAvailable() 返回 false。
let writeCached: DatabaseSync | null = null
function getWriteDb(): DatabaseSync {
  if (writeCached) return writeCached
  return (writeCached = new DatabaseSync(dbPath))
}

/** kanban.db 是否存在（Hermes 是否已初始化） */
export function kanbanAvailable(): boolean { return existsSync(dbPath) }

/** 创建任务，返回新任务 id。有 assignee 则进 todo，否则进 triage 待分拣 */
export function createTask(input: { title: string; body?: string | null; assignee?: string | null; priority?: number }): string {
  const db = getWriteDb()
  const id = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)
  const status = input.assignee ? 'todo' : 'triage'
  db.prepare('INSERT INTO tasks (id,title,body,assignee,status,priority,created_at) VALUES (?,?,?,?,?,?,?)')
    .run(id, input.title, input.body ?? null, input.assignee ?? null, status, input.priority ?? 0, now)
  return id
}

/** 取消任务（移出活跃看板） */
export function killTask(id: string): void {
  getWriteDb().prepare('UPDATE tasks SET status=? WHERE id=?').run('cancelled', id)
}

/** 重新指派（assignee 为空则取消指派） */
export function assignTask(id: string, assignee: string | null): void {
  getWriteDb().prepare('UPDATE tasks SET assignee=? WHERE id=?').run(assignee || null, id)
}

/** 拆分为子任务：创建子任务 + task_links 关联，父任务标记 blocked。返回子任务 id 列表 */
export function decomposeTask(id: string, subTasks: string[]): string[] {
  const db = getWriteDb()
  const now = Math.floor(Date.now() / 1000)
  const parent = db.prepare('SELECT assignee FROM tasks WHERE id=?').get(id) as any
  const insertTask = db.prepare('INSERT INTO tasks (id,title,body,assignee,status,priority,created_at) VALUES (?,?,?,?,?,?,?)')
  const insertLink = db.prepare('INSERT INTO task_links (parent_id, child_id) VALUES (?,?)')
  const childIds: string[] = []
  for (const title of subTasks) {
    const cid = crypto.randomUUID()
    insertTask.run(cid, title, null, parent?.assignee ?? null, 'triage', 0, now)
    insertLink.run(id, cid)
    childIds.push(cid)
  }
  if (childIds.length) db.prepare('UPDATE tasks SET status=? WHERE id=?').run('blocked', id)
  return childIds
}
