import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

let cached: DatabaseSync | null = null

export function useDb(): DatabaseSync {
  if (cached) return cached
  const dbPath = resolve(process.cwd(), 'data/yggdrasil.db')
  mkdirSync(dirname(dbPath), { recursive: true })
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec(`CREATE TABLE IF NOT EXISTS profiles (
    slug TEXT PRIMARY KEY, display_name TEXT NOT NULL, engine TEXT NOT NULL DEFAULT 'hermes',
    is_default INTEGER NOT NULL DEFAULT 0, hermes_dir TEXT NOT NULL DEFAULT '',
    avatar_seed TEXT NOT NULL DEFAULT '', background_color TEXT NOT NULL DEFAULT '#6366f1',
    gesture TEXT NOT NULL DEFAULT 'hand', given_name TEXT,
    active INTEGER NOT NULL DEFAULT 1, present INTEGER NOT NULL DEFAULT 1,
    first_seen TEXT NOT NULL DEFAULT '', last_seen TEXT NOT NULL DEFAULT ''
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY, orchestrator_slug TEXT NOT NULL, title TEXT,
    status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, last_message_at TEXT NOT NULL
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS mission_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT, mission_id TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
    role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL
  )`)
  db.exec('CREATE INDEX IF NOT EXISTS idx_mission_messages_mission ON mission_messages(mission_id, id)')
  // 新增列 (兼容已有 DB)
  try { db.exec("ALTER TABLE profiles ADD COLUMN model TEXT DEFAULT ''") } catch {}
  try { db.exec("ALTER TABLE profiles ADD COLUMN api_key TEXT DEFAULT ''") } catch {}
  try { db.exec("ALTER TABLE profiles ADD COLUMN api_url TEXT DEFAULT ''") } catch {}
  // task_stats - 任务执行统计
  db.exec(`CREATE TABLE IF NOT EXISTS task_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    engine TEXT NOT NULL,
    profile_slug TEXT NOT NULL,
    task_id TEXT,
    status TEXT NOT NULL DEFAULT 'completed',
    duration_ms INTEGER DEFAULT 0,
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL
  )`)
  db.exec('CREATE INDEX IF NOT EXISTS idx_task_stats_engine ON task_stats(engine)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_task_stats_profile ON task_stats(profile_slug)')

  cached = db
  return db
}
