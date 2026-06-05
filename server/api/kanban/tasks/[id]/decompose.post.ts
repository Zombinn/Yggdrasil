import { decomposeTask, kanbanAvailable } from '../../../../utils/engines/kanban'

export default defineEventHandler(async (event) => {
  if (!kanbanAvailable()) throw createError({ statusCode: 503, statusMessage: 'Hermes kanban.db 不存在（Hermes 未安装或未初始化）' })
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  const body = await readBody<{ subTasks?: string[] }>(event)
  const subs = (body?.subTasks ?? []).map(s => (s || '').trim()).filter(Boolean)
  if (!subs.length) throw createError({ statusCode: 400, statusMessage: 'subTasks required' })
  const childIds = decomposeTask(id, subs)
  return { ok: true, childIds }
})
