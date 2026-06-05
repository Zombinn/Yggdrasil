import { useDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400 })

  const body = await readBody<{ message: string }>(event)
  if (!body?.message) throw createError({ statusCode: 400, statusMessage: 'message required' })

  const db = useDb()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO mission_messages (mission_id, role, content, created_at) VALUES (?,?,?,?)').run(id, 'user', body.message, now)
  db.prepare('UPDATE missions SET last_message_at = ? WHERE id = ?').run(now, id)

  return { ok: true }
})
