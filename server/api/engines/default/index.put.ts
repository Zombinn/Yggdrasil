import { setDefaultEngine } from '../../../utils/engines/index'
import type { EngineId } from '../../../utils/engines/types'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ engine: EngineId }>(event)
  if (!body?.engine) throw createError({ statusCode: 400, statusMessage: 'engine required' })
  setDefaultEngine(body.engine)
  return { ok: true, engine: body.engine }
})
