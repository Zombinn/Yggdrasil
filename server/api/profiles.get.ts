import { useDb } from '../utils/db'
import { discoverAllProfiles } from '../utils/engines/index'
import type { Profile } from '~/types/profile'

export default defineEventHandler(async () => {
  const db = useDb()
  const now = new Date().toISOString()
  const discovered = await discoverAllProfiles()

  const insert = db.prepare(`INSERT INTO profiles (slug,display_name,engine,is_default,hermes_dir,avatar_seed,background_color,gesture,first_seen,last_seen,present)
    VALUES (?,?,?,?,?,?,?,'hand',?,?,1) ON CONFLICT(slug) DO UPDATE SET
    display_name=excluded.display_name,engine=excluded.engine,is_default=excluded.is_default,
    hermes_dir=excluded.hermes_dir,last_seen=excluded.last_seen,present=1`)
  db.exec('UPDATE profiles SET present=0')

  for (const p of discovered) {
    insert.run(p.slug, p.displayName ?? p.slug, p.engine, p.isDefault ? 1 : 0, p.hermesDir, defaultSeed(p.slug), pickColor(p.slug), now, now)
  }

  const rows = db.prepare('SELECT * FROM profiles WHERE present=1 ORDER BY is_default DESC, engine ASC, slug ASC').all() as any[]
  return rows.map((r: any) => ({
    slug: r.slug, displayName: r.display_name, givenName: r.given_name, engine: r.engine,
    isDefault: r.is_default === 1, active: r.active === 1, hermesDir: r.hermes_dir,
    backgroundColor: r.background_color, gesture: r.gesture, avatarSeed: r.avatar_seed,
    avatarUrl: `https://api.dicebear.com/9.x/notionists/svg?seed=${r.avatar_seed}&backgroundColor=${r.background_color}&size=240`,
    avatarPortraitUrl: `https://api.dicebear.com/9.x/notionists/svg?seed=${r.avatar_seed}&size=320`,
    firstSeen: r.first_seen, lastSeen: r.last_seen, description: null, model: r.model || null
  } satisfies Profile))
})

function defaultSeed(slug: string): string { return slug.replace(/[^a-zA-Z0-9]/g, '') || 'default' }
function pickColor(slug: string): string {
  const colors = ['6366f1','8b5cf6','ec4899','f43f5e','f97316','eab308','22c55e','14b8a6','06b6d4','3b82f6']
  let hash = 0; for (let i = 0; i < slug.length; i++) { hash = ((hash << 5) - hash) + slug.charCodeAt(i); hash |= 0 }
  return colors[Math.abs(hash) % colors.length]
}
