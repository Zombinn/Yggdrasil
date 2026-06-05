import { useDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400 })
  const db = useDb()
  db.prepare("UPDATE missions SET status = 'archived' WHERE id = ?").run(id)
  return { ok: true }
})
