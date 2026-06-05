import { createTask, kanbanAvailable } from '../../../utils/engines/kanban'

export default defineEventHandler(async (event) => {
  if (!kanbanAvailable()) throw createError({ statusCode: 503, statusMessage: 'Hermes kanban.db 不存在（Hermes 未安装或未初始化）' })
  const body = await readBody<{ title?: string; body?: string; assignee?: string; priority?: number }>(event)
  if (!body?.title?.trim()) throw createError({ statusCode: 400, statusMessage: 'title required' })
  const id = createTask({
    title: body.title.trim(),
    body: body.body || null,
    assignee: body.assignee || null,
    priority: typeof body.priority === 'number' ? body.priority : 0,
  })
  return { ok: true, id }
})
