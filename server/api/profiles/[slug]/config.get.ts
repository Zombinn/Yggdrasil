import { useDb } from '../../../utils/db'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400 })

  const db = useDb()
  const row = db.prepare('SELECT slug, given_name, active, engine, model, api_key, api_url FROM profiles WHERE slug=?').get(slug) as any
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Profile not found' })

  return {
    slug: row.slug,
    givenName: row.given_name,
    active: row.active === 1,
    engine: row.engine,
    model: row.model || 'claude-sonnet-4-20250514',
    apiKey: row.api_key ? '****' + row.api_key.slice(-4) : null,
    apiUrl: row.api_url || null
  }
})
