import { useDb } from '../utils/db'
import { warmup } from '../utils/orchestrator-acp'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ orchestratorSlug: string; message: string }>(event)
  if (!body?.orchestratorSlug || !body?.message) throw createError({ statusCode: 400, statusMessage: 'orchestratorSlug and message required' })

  const db = useDb()
  const missionId = crypto.randomUUID()
  const now = new Date().toISOString()

  db.prepare('INSERT INTO missions (id, orchestrator_slug, title, status, created_at, last_message_at) VALUES (?,?,?,?,?,?)').run(
    missionId, body.orchestratorSlug, body.message.slice(0, 80), 'open', now, now
  )
  db.prepare('INSERT INTO mission_messages (mission_id, role, content, created_at) VALUES (?,?,?,?)').run(
    missionId, 'user', body.message, now
  )

  // 预热 ACP 连接（异步，不阻塞响应）
  warmup(body.orchestratorSlug).catch(() => {})

  return {
    mission: {
      id: missionId,
      orchestratorSlug: body.orchestratorSlug,
      title: body.message.slice(0, 80),
      status: 'open',
      createdAt: now,
      lastMessageAt: now,
      mode: 'conversational',
      triageTaskId: null
    }
  }
})
