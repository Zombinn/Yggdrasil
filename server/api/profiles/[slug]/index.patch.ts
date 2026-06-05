import { useDb } from '../../../utils/db'
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'slug required' })
  const body = await readBody<{ givenName?: string; active?: boolean }>(event)
  if (!body) throw createError({ statusCode: 400 })
  const db = useDb()
  if (body.givenName !== undefined) db.prepare('UPDATE profiles SET given_name=? WHERE slug=?').run(body.givenName, slug)
  if (body.active !== undefined) db.prepare('UPDATE profiles SET active=? WHERE slug=?').run(body.active ? 1 : 0, slug)
  return { ok: true }
})
