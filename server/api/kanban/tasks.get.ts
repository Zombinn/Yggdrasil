import { listActiveTasks, dispatcherLikelyStale } from '../../utils/engines/kanban'
export default defineEventHandler((event) => {
  const q = getQuery(event)
  const tasks = listActiveTasks(typeof q.assignee === 'string' ? q.assignee : undefined)
  return { tasks, dispatcherStale: dispatcherLikelyStale() }
})
