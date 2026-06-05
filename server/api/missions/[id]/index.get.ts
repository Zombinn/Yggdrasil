import { useDb } from '../../../utils/db'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400 })

  const db = useDb()
  const mission = db.prepare('SELECT * FROM missions WHERE id = ?').get(id) as any
  if (!mission) throw createError({ statusCode: 404, statusMessage: 'Mission not found' })

  const messages = db.prepare('SELECT * FROM mission_messages WHERE mission_id = ? ORDER BY id ASC').all(id) as any[]

  return {
    mission: {
      id: mission.id, orchestratorSlug: mission.orchestrator_slug, title: mission.title,
      status: mission.status, createdAt: mission.created_at, lastMessageAt: mission.last_message_at
    },
    messages: messages.map((r: any) => ({
      id: r.id, role: r.role, content: r.content, createdAt: r.created_at
    }))
  }
})
