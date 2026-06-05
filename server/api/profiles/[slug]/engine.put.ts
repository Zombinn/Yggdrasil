import { setProfileEngine } from '../../../utils/engines/index'
import type { EngineId } from '../../../utils/engines/types'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'slug required' })
  const body = await readBody<{ engine: EngineId }>(event)
  if (!body?.engine) throw createError({ statusCode: 400, statusMessage: 'engine required' })
  setProfileEngine(slug, body.engine)
  return { ok: true }
})
