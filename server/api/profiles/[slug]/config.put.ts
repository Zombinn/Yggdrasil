import { useDb } from '../../../utils/db'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'slug required' })

  const body = await readBody<{
    model?: string; apiKey?: string; apiUrl?: string
    givenName?: string; active?: boolean; engine?: string
  }>(event)
  if (!body) throw createError({ statusCode: 400 })

  const db = useDb()
  if (body.givenName !== undefined) {
    db.prepare('UPDATE profiles SET given_name=? WHERE slug=?').run(body.givenName, slug)
  }
  if (body.active !== undefined) {
    db.prepare('UPDATE profiles SET active=? WHERE slug=?').run(body.active ? 1 : 0, slug)
  }
  if (body.engine !== undefined) {
    db.prepare('UPDATE profiles SET engine=? WHERE slug=?').run(body.engine, slug)
  }
  if (body.model !== undefined) {
    db.prepare('UPDATE profiles SET model=? WHERE slug=?').run(body.model, slug)
  }
  if (body.apiKey !== undefined) {
    db.prepare('UPDATE profiles SET api_key=? WHERE slug=?').run(body.apiKey, slug)
  }
  if (body.apiUrl !== undefined) {
    db.prepare('UPDATE profiles SET api_url=? WHERE slug=?').run(body.apiUrl, slug)
  }

  return { ok: true }
})
