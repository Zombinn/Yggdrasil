import { useDb } from '../../utils/db'

export default defineEventHandler(() => {
  const db = useDb()

  const byEngine = db.prepare(`SELECT engine, COUNT(*) as total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) as failed, AVG(duration_ms) as avgDuration, SUM(tokens_input) as totalTokensIn, SUM(tokens_output) as totalTokensOut FROM task_stats GROUP BY engine`).all() as any[]

  const byProfile = db.prepare(`SELECT profile_slug as profileSlug, engine, COUNT(*) as total, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) as completed, AVG(duration_ms) as avgDuration FROM task_stats GROUP BY profile_slug ORDER BY total DESC LIMIT 20`).all() as any[]

  const recent = db.prepare(`SELECT id, engine, profile_slug as profileSlug, status, duration_ms as durationMs, error, created_at FROM task_stats ORDER BY created_at DESC LIMIT 50`).all() as any[]

  return { byEngine, byProfile, recent }
})
