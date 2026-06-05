import { killTask, kanbanAvailable } from '../../../../utils/engines/kanban'

export default defineEventHandler((event) => {
  if (!kanbanAvailable()) throw createError({ statusCode: 503, statusMessage: 'Hermes kanban.db 不存在（Hermes 未安装或未初始化）' })
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'id required' })
  killTask(id)
  return { ok: true }
})
