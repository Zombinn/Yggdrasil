import { useDb } from '../../utils/db'

export default defineEventHandler((event) => {
  const q = getQuery(event)
  const db = useDb()
  let sql = 'SELECT * FROM missions'
  const params: unknown[] = []

  if (q.status === 'open') {
    sql += " WHERE status = 'open'"
  } else if (q.status === 'archived') {
    sql += " WHERE status = 'archived'"
  }

  sql += ' ORDER BY last_message_at DESC'

  if (typeof q.pageSize === 'string') {
    sql += ' LIMIT ?'
    params.push(parseInt(q.pageSize))
  }

  const rows = db.prepare(sql).all(...params) as any[]
  return { missions: rows.map(r => ({
    id: r.id, orchestratorSlug: r.orchestrator_slug, title: r.title,
    status: r.status, createdAt: r.created_at, lastMessageAt: r.last_message_at
  })) }
})
